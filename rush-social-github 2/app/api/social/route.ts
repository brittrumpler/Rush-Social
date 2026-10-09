import { env } from 'cloudflare:workers';
import { identity, ApiError, errorResponse, textField, sameOrigin, SYMBOLS } from '../../../lib/game';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function database(){if(!env.DB)throw new ApiError(503,'Shared storage is not connected yet.');return env.DB;}
async function author(req:Request){const u=await identity(req);const db=database();await db.prepare('INSERT INTO users(id,name,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(u.id,u.name,Date.now()).run();return u;}
export async function GET(req:Request){try{
 const u=await author(req),db=database(),q=new URL(req.url).searchParams,view=q.get('view')||'all',cursor=Number(q.get('before')||0);
 if(!['all','trade','joke','mine'].includes(view)||!Number.isFinite(cursor)||cursor<0)throw new ApiError(400,'Invalid feed filter.');
 const clauses:string[]=[],args:any[]=[u.id];if(view==='mine'){clauses.push('p.user_id=?');args.push(u.id);}else if(view!=='all'){clauses.push('p.kind=?');args.push(view);}if(cursor){clauses.push('p.created_at<?');args.push(cursor);}
 const sql=`SELECT p.*, u.name AS author_name,u.avatar_id,u.worth,u.cash,u.rank,u.updated_at AS profile_updated_at, (SELECT COUNT(*) FROM likes WHERE post_id=p.id) AS likes, (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments, EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) AS liked FROM posts p JOIN users u ON u.id=p.user_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY p.created_at DESC,p.id DESC LIMIT 31`;
 const list=await db.prepare(sql).bind(...args).all();const result=list.results||[];
 const totals=await db.prepare('SELECT (SELECT COUNT(*) FROM posts) AS posts,(SELECT COUNT(*) FROM users) AS members').first();
 return response({user:{id:u.id,name:u.name},posts:result.slice(0,30),next:result.length>30?(result[29] as any).created_at:null,totals});
 }catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);if(Number(req.headers.get('content-length')||0)>15000)throw new ApiError(413,'Post is too large.');
 const u=await author(req),db=database();const raw=await req.text();if(raw.length>15000)throw new ApiError(413,'Post is too large.');let body:any;try{body=JSON.parse(raw);}catch{throw new ApiError(400,'Invalid post.');}
 const action=body.action;
 if(action==='create'){
  const kind=body.kind;if(!['trade','joke','chat'].includes(kind))throw new ApiError(400,'Choose a post type.');
  const content=textField(body.content,1200,false),symbol=body.symbol?textField(body.symbol,10):null;if(symbol&&!SYMBOLS.includes(symbol))throw new ApiError(400,'Unknown stock symbol.');
  const imageId=body.imageId?textField(body.imageId,80):null;
  if(imageId){const image=await db.prepare('SELECT id FROM uploads WHERE id=? AND user_id=?').bind(imageId,u.id).first();if(!image)throw new ApiError(403,'That image does not belong to your account.');const used=await db.prepare('SELECT id FROM posts WHERE image_id=?').bind(imageId).first();if(used)throw new ApiError(400,'This image is already attached to a post.');}
  let trade=null;if(body.tradeId!=null){const original=u.trades.find((t:any)=>String(t.id)===String(body.tradeId));if(!original)throw new ApiError(400,'That trade is not in your recent MarketRush history.');trade={id:original.id,symbol:original.symbol,side:original.side,shares:original.shares,price:Number(original.price),total:Number(original.total),pnl:original.pnl==null?null:Number(original.pnl),time:original.time};if(kind!=='trade')throw new ApiError(400,'Trade receipts belong on trade posts.');}
  if(!content&&!imageId&&!trade)throw new ApiError(400,'Add text, a screenshot, or a trade receipt.');
  const recent=await db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id=? AND created_at>?').bind(u.id,Date.now()-60000).first<any>();if(Number(recent?.n)>=5)throw new ApiError(429,'Give the feed a moment: five posts per minute maximum.');
  const id=crypto.randomUUID();await db.prepare('INSERT INTO posts(id,user_id,author,kind,content,symbol,trade_json,image_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,u.id,u.name,kind,content,trade?.symbol||symbol,trade?JSON.stringify(trade):null,imageId,Date.now()).run();return response({id},201);
 }
 const postId=textField(body.postId,80),post=await db.prepare('SELECT id,user_id,image_id FROM posts WHERE id=?').bind(postId).first<any>();if(!post)throw new ApiError(404,'Post not found.');
 if(action==='like'){if(typeof body.liked!=='boolean')throw new ApiError(400,'Invalid reaction.');if(body.liked)await db.prepare('INSERT INTO likes(post_id,user_id,created_at) VALUES(?,?,?) ON CONFLICT(post_id,user_id) DO NOTHING').bind(postId,u.id,Date.now()).run();else await db.prepare('DELETE FROM likes WHERE post_id=? AND user_id=?').bind(postId,u.id).run();return response({ok:true});}
 if(action==='comment'){
  const content=textField(body.content,500);const recent=await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE user_id=? AND created_at>?').bind(u.id,Date.now()-60000).first<any>();if(Number(recent?.n)>=15)throw new ApiError(429,'Too many replies. Try again in a moment.');
  await db.prepare('INSERT INTO comments(id,post_id,user_id,author,content,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),postId,u.id,u.name,content,Date.now()).run();return response({ok:true},201);
 }
 if(action==='delete'){
  if(post.user_id!==u.id)throw new ApiError(403,'You can only delete your own posts.');
  await db.batch([db.prepare('DELETE FROM likes WHERE post_id=?').bind(postId),db.prepare('DELETE FROM comments WHERE post_id=?').bind(postId),db.prepare('DELETE FROM posts WHERE id=? AND user_id=?').bind(postId,u.id)]);
  if(post.image_id&&env.BUCKET){await env.BUCKET.delete(post.image_id);await db.prepare('DELETE FROM uploads WHERE id=? AND user_id=?').bind(post.image_id,u.id).run();}return response({ok:true});
 }
 throw new ApiError(400,'Unknown action.');
 }catch(e){return errorResponse(e);}}
