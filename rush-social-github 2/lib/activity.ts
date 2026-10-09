import { env } from 'cloudflare:workers';
import { gameFetch } from './game';
export async function importTrades(name:string,trades:any[]){if(!env.DB)return;const statements=[];for(const t of trades){const time=typeof t.time==='number'?t.time:Date.parse(t.time),shares=Number(t.shares),price=Number(t.price),total=Number(t.total);if(t.id==null||!Number.isFinite(time)||!Number.isFinite(shares)||shares<=0||!Number.isFinite(price)||price<=0||!Number.isFinite(total)||!['BUY','SELL'].includes(String(t.side).toUpperCase())||typeof t.symbol!=='string')continue;
 const id=JSON.stringify([name,String(t.id)]);statements.push(env.DB.prepare('INSERT INTO trade_activity(id,trader,trade_id,symbol,side,shares,price,total,pnl,traded_at,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,name,String(t.id),t.symbol,String(t.side).toUpperCase(),shares,String(price),String(total),t.pnl==null?null:String(t.pnl),time,Date.now()));}
 for(let i=0;i<statements.length;i+=50)await env.DB.batch(statements.slice(i,i+50));}
export async function collectActivity(token:string,ownName:string,ownTrades:any[]){
 if(!env.DB)return {warning:'Storage unavailable.'};await importTrades(ownName,ownTrades);
 await env.DB.prepare("INSERT INTO sync_state(id,last_sync,cursor) VALUES('market',0,0) ON CONFLICT(id) DO NOTHING").run();
 const now=Date.now(),lease=await env.DB.prepare("UPDATE sync_state SET last_sync=? WHERE id='market' AND last_sync<? RETURNING cursor").bind(now,now-20000).first<any>();if(!lease)return {warning:null};
 try{const board=await gameFetch('/rest/v1/rpc/mr_leaderboard',token,{});const social=await env.DB.prepare('SELECT name FROM users ORDER BY name').all<{name:string}>();const names=[...new Set<string>([ownName,...(board.top||[]).map((x:any)=>x.name),...social.results.map(x=>x.name)].filter(n=>typeof n==='string'&&n))];const batch=Array.from({length:Math.min(8,names.length)},(_,i)=>names[(Number(lease.cursor)+i)%names.length]);
 const results=await Promise.allSettled(batch.map(async name=>{if(name===ownName)return;const p=await gameFetch('/rest/v1/rpc/mr_profile',token,{p_name:name});await importTrades(name,Array.isArray(p.trades)?p.trades:[]);}));await env.DB.prepare("UPDATE sync_state SET cursor=? WHERE id='market'").bind((Number(lease.cursor)+batch.length)%Math.max(1,names.length)).run();return {warning:results.some(r=>r.status==='rejected')?'Some trader histories could not be refreshed. Previously collected trades are still shown.':null};
 }catch{return {warning:'Game-wide sync is temporarily unavailable. Your recent trades were synced.'};}
}
