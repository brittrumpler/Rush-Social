import { env } from 'cloudflare:workers';
import { identity,ApiError,errorResponse,sameOrigin } from '../../../lib/game';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 sameOrigin(req);const u=await identity(req);if(!env.DB||!env.BUCKET)throw new ApiError(503,'Image storage is not connected yet.');
 if(Number(req.headers.get('content-length')||0)>5*1024*1024)throw new ApiError(413,'Images must be under 5 MB.');
 const bytes=new Uint8Array(await req.arrayBuffer());if(!bytes.length||bytes.length>5*1024*1024)throw new ApiError(413,'Images must be under 5 MB.');
 let mime='';if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)mime='image/jpeg';else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))mime='image/png';else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';if(!mime)throw new ApiError(400,'Upload a JPEG, PNG, or WebP image.');
 await env.DB.prepare('INSERT INTO users(id,name,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(u.id,u.name,Date.now()).run();
 const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM uploads WHERE user_id=? AND created_at>?').bind(u.id,Date.now()-3600000).first<any>();if(Number(recent?.n)>=20)throw new ApiError(429,'Upload limit reached. Try again later.');
 const id=crypto.randomUUID();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:mime}});
 try{await env.DB.prepare('INSERT INTO uploads(id,user_id,mime,created_at) VALUES(?,?,?,?)').bind(id,u.id,mime,Date.now()).run();}catch(e){await env.BUCKET.delete(id);throw e;}
 return Response.json({id},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}}
