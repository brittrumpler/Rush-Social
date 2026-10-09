import { env } from 'cloudflare:workers';
import { identity, gameFetch, ApiError } from './game';
export async function syncProfile(req:Request){
 const u=await identity(req);if(!env.DB)throw new ApiError(503,'Social storage is not connected.');
 const profile=await gameFetch('/rest/v1/rpc/mr_profile',u.token,{p_name:u.name});
 const worth=Number(profile.worth),cash=Number(profile.cash),rank=Number(profile.rank);
 if(!Number.isFinite(worth)||!Number.isFinite(cash))throw new ApiError(503,'The game returned an invalid balance.');
 await env.DB.prepare('INSERT INTO users(id,name,worth,cash,rank,updated_at,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,worth=excluded.worth,cash=excluded.cash,rank=excluded.rank,updated_at=excluded.updated_at').bind(u.id,u.name,String(worth),String(cash),rank>0?rank:null,Date.now(),Date.now()).run();
 const social=await env.DB.prepare('SELECT id,name,bio,avatar_id,worth,cash,rank,updated_at,created_at FROM users WHERE id=?').bind(u.id).first();
 return {...u,social};
}
