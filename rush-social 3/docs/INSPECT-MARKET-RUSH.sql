-- Run in the existing Market Rush project's Supabase SQL Editor as its owner.
-- Read-only: retrieves schema/function definitions, not player rows or credentials.
-- Return the results to finish the server-side trade integration.

-- Result 1: exact game function definitions, signatures, and execution mode.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('mr_trade','mr_me','mr_profile','mr_leaderboard')
  and p.prokind='f'
order by p.proname,p.oid;

-- Result 2: public table columns and defaults (no player data).
select table_name,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name not like 'rs\_%' escape '\'
order by table_name,ordinal_position;

-- Result 3: existing public-table triggers, excluding Rush Social objects.
select c.relname as table_name,t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as trigger_definition,
       pg_get_functiondef(t.tgfoid) as trigger_function_definition
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
  and c.relname not like 'rs\_%' escape '\'
order by c.relname,t.tgname;
