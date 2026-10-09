-- Run once in the EXISTING Market Rush Supabase project's SQL editor.
-- This adds only rs_* objects and a rush-media bucket; existing game tables are untouched.
begin;
create table public.rs_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio)<=160),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.rs_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.rs_profiles(id) on delete cascade,
  body text not null default '' check (char_length(body)<=1000),
  kind text not null default 'post' check (kind in ('post','banter','trade')),
  image_url text,
  trade jsonb,
  source_trade_id text unique,
  created_at timestamptz not null default now(),
  check ((kind='trade' and trade is not null and source_trade_id is not null) or (kind in ('post','banter') and trade is null and source_trade_id is null and char_length(trim(body))>0))
);
create table public.rs_likes (
  post_id uuid not null references public.rs_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id,user_id)
);
create table public.rs_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rs_posts(id) on delete cascade,
  author_id uuid not null references public.rs_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index rs_posts_timeline on public.rs_posts(created_at desc,id desc);
create index rs_posts_author on public.rs_posts(author_id,created_at desc);
create index rs_comments_post on public.rs_comments(post_id,created_at);

alter table public.rs_profiles enable row level security;
alter table public.rs_posts enable row level security;
alter table public.rs_likes enable row level security;
alter table public.rs_comments enable row level security;
-- Explicit grants avoid relying on the project's default privileges.
revoke all on public.rs_profiles,public.rs_posts,public.rs_likes,public.rs_comments from anon,authenticated;
grant select on public.rs_profiles,public.rs_posts,public.rs_likes,public.rs_comments to authenticated;
grant update (display_name,bio,avatar_url) on public.rs_profiles to authenticated;
grant insert (author_id,body,kind,image_url) on public.rs_posts to authenticated;
grant delete on public.rs_posts to authenticated;
grant insert (post_id,author_id,body) on public.rs_comments to authenticated;
grant delete on public.rs_comments to authenticated;
create policy rs_profiles_read on public.rs_profiles for select to authenticated using (true);
create policy rs_profiles_edit on public.rs_profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy rs_posts_read on public.rs_posts for select to authenticated using (true);
create policy rs_posts_write on public.rs_posts for insert to authenticated with check ((select auth.uid())=author_id and kind in ('post','banter') and trade is null and source_trade_id is null);
create policy rs_posts_delete on public.rs_posts for delete to authenticated using ((select auth.uid())=author_id and kind<>'trade');
create policy rs_likes_read on public.rs_likes for select to authenticated using (true);
create policy rs_comments_read on public.rs_comments for select to authenticated using (true);
create policy rs_comments_write on public.rs_comments for insert to authenticated with check ((select auth.uid())=author_id);
create policy rs_comments_delete on public.rs_comments for delete to authenticated using ((select auth.uid())=author_id);

-- Verified name from the game's existing authenticated RPC. Browser cannot impersonate a player.
create function public.rs_ensure_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_game jsonb; v_player jsonb; v_profile public.rs_profiles;
begin
  if v_uid is null then raise exception 'Please sign in to Market Rush first.'; end if;
  v_game := public.mr_me()::jsonb;
  v_player := v_game->'player';
  if nullif(v_player->>'name','') is null then raise exception 'Create your trader name in Market Rush first.'; end if;
  insert into public.rs_profiles(id,name,display_name) values(v_uid,v_player->>'name',v_player->>'name')
  on conflict(id) do update set name=excluded.name returning * into v_profile;
  return to_jsonb(v_profile);
end $$;
revoke all on function public.rs_ensure_profile() from public,anon;
grant execute on function public.rs_ensure_profile() to authenticated;

create function public.rs_feed(p_offset integer default 0,p_limit integer default 30) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
    'author',to_jsonb(a),'likes',(select count(*) from public.rs_likes l where l.post_id=p.id),
    'liked',exists(select 1 from public.rs_likes l where l.post_id=p.id and l.user_id=auth.uid()),
    'comment_count',(select count(*) from public.rs_comments c where c.post_id=p.id)
  ) order by p.created_at desc,p.id desc),'[]'::jsonb)
  from (select * from public.rs_posts order by created_at desc,id desc limit least(greatest(p_limit,1),50) offset greatest(p_offset,0)) p
  join public.rs_profiles a on a.id=p.author_id;
$$;
revoke all on function public.rs_feed(integer,integer) from public,anon;
grant execute on function public.rs_feed(integer,integer) to authenticated;

create function public.rs_toggle_like(p_post_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or not exists(select 1 from public.rs_profiles where id=v_uid) then raise exception 'Sign in with a Market Rush account first.'; end if;
  -- Serialize concurrent toggles by one player on the same post.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||p_post_id::text,0));
  delete from public.rs_likes where post_id=p_post_id and user_id=v_uid;
  if found then return false; end if;
  insert into public.rs_likes(post_id,user_id) values(p_post_id,v_uid);
  return true;
end $$;
revoke all on function public.rs_toggle_like(uuid) from public,anon;
grant execute on function public.rs_toggle_like(uuid) to authenticated;

-- Server-only ingestion: call from mr_trade or an AFTER INSERT trigger.
-- Every game player gets a social identity on their first captured trade, even if they never visit Rush Social.
-- Never grant this to authenticated/anon or call it from browser code.
create function public.rs_record_trade(p_user_id uuid,p_name text,p_source_id text,p_trade jsonb,p_created_at timestamptz default now()) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_source_id is null or nullif(p_name,'') is null then raise exception 'Missing trade identity.'; end if;
  if coalesce(p_trade->>'side','') not in ('BUY','SELL') or nullif(p_trade->>'symbol','') is null or
    coalesce((p_trade->>'shares')::numeric,0)<=0 or coalesce((p_trade->>'price')::numeric,-1)<0 then
    raise exception 'Invalid trade payload.';
  end if;
  insert into public.rs_profiles(id,name,display_name) values(p_user_id,p_name,p_name)
    on conflict(id) do update set name=excluded.name;
  insert into public.rs_posts(author_id,kind,trade,source_trade_id,created_at)
    values(p_user_id,'trade',p_trade,p_source_id,p_created_at)
    on conflict(source_trade_id) do nothing;
end $$;
revoke all on function public.rs_record_trade(uuid,text,text,jsonb,timestamptz) from public,anon,authenticated;
-- The owner of the game RPC/trigger (typically postgres) can invoke it.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rush-media','rush-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy rs_media_read on storage.objects for select to authenticated using (bucket_id='rush-media');
create policy rs_media_insert on storage.objects for insert to authenticated with check (
  bucket_id='rush-media' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.rs_profiles where id=(select auth.uid()))
);
create policy rs_media_delete on storage.objects for delete to authenticated using (
  bucket_id='rush-media' and (storage.foldername(name))[1]=(select auth.uid())::text
);
commit;
