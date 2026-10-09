import { env } from 'cloudflare:workers';
import { identity,ApiError,errorResponse } from '../../../../lib/game';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const u=await identity(req),{id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(404,'Image not found.');if(!env.DB||!env.BUCKET)throw new ApiError(503,'Image storage unavailable.');
 const visible=await env.DB.prepare('SELECT id FROM uploads WHERE id=? AND (user_id=? OR EXISTS(SELECT 1 FROM posts WHERE image_id=?) OR EXISTS(SELECT 1 FROM users WHERE avatar_id=?))').bind(id,u.id,id,id).first();if(!visible)throw new ApiError(404,'Image not found.');const file=await env.BUCKET.get(id);if(!file)throw new ApiError(404,'Image not found.');return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){return errorResponse(e);}}
