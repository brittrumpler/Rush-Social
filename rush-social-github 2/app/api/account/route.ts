import { env } from 'cloudflare:workers';
import { identity,errorResponse,ApiError,textField,sameOrigin,gameFetch } from '../../../lib/game';
import { syncProfile } from '../../../lib/profile';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const name=new URL(req.url).searchParams.get('name');
 if(name){const u=await identity(req);const profile=await gameFetch('/rest/v1/rpc/mr_profile',u.token,{p_name:textField(name,80)});const social=env.DB?await env.DB.prepare('SELECT id,name,bio,avatar_id,created_at FROM users WHERE name=?').bind(profile.name).first():null;return Response.json({profile:{...(social||{}),name:profile.name,worth:profile.worth,cash:profile.cash,rank:profile.rank,updated_at:Date.now()},trades:[]},{headers:{'Cache-Control':'no-store'}});}
 const u=await syncProfile(req);return Response.json({profile:u.social,trades:u.trades.slice(0,50)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{sameOrigin(req);const u=await identity(req);if(!env.DB)throw new ApiError(503,'Storage unavailable.');const body=await req.json() as any;const bio=textField(body.bio,160,false);const avatar=body.avatarId?textField(body.avatarId,80):null;
 if(avatar){const file=await env.DB.prepare('SELECT id FROM uploads WHERE id=? AND user_id=?').bind(avatar,u.id).first();if(!file)throw new ApiError(403,'Upload your own profile picture first.');}
 await env.DB.prepare('UPDATE users SET bio=?,avatar_id=? WHERE id=?').bind(bio,avatar,u.id).run();return Response.json({ok:true});}catch(e){return errorResponse(e);}}
