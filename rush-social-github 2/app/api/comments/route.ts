import { env } from 'cloudflare:workers';
import { identity,ApiError,errorResponse } from '../../../lib/game';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{await identity(req);if(!env.DB)throw new ApiError(503,'Shared storage is not connected yet.');const id=new URL(req.url).searchParams.get('postId');if(!id||id.length>80)throw new ApiError(400,'Invalid post.');const data=await env.DB.prepare('SELECT id,author,content,created_at FROM comments WHERE post_id=? ORDER BY created_at ASC LIMIT 100').bind(id).all();return Response.json({comments:data.results},{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
