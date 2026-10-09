export const GAME_URL='https://hrdshcnqgmfrklnietny.supabase.co';
export const GAME_KEY='sb_publishable_rF43LSkajxLcjkkSjhM5eQ_9_vPJu3Y';
export const SYMBOLS=['AAPL','TSLA','NVDA','AMZN','MSFT','GOOGL','BRUMP','ZOEY'];
export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export async function gameFetch(path:string,token:string,body?:unknown){
 let r:Response;try{r=await fetch(GAME_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:GAME_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});}catch{throw new ApiError(503,'MarketRush is unavailable. Please try again.');}
 const data:any=await r.json();if(!r.ok)throw new ApiError(r.status===401||r.status===403?401:503,'Your MarketRush session expired or the game could not verify it.');return data;
}
export async function identity(request:Request){
 const header=request.headers.get('authorization')||'';
 if(!header.startsWith('Bearer ')||header.length>10000)throw new ApiError(401,'Sign in with MarketRush first.');
 const token=header.slice(7);const user=await gameFetch('/auth/v1/user',token);
 if(typeof user.id!=='string'||!user.id)throw new ApiError(401,'Invalid game account.');
 const me=await gameFetch('/rest/v1/rpc/mr_me',token,{});
 if(!me.player||typeof me.player.name!=='string')throw new ApiError(403,'Join MarketRush in the original game first.');
 return {id:user.id,name:me.player.name.slice(0,80),token,player:me.player,trades:Array.isArray(me.trades)?me.trades:[]};
}
export function errorResponse(e:unknown){return Response.json({error:e instanceof ApiError?e.message:'Something went wrong. Please try again.'},{status:e instanceof ApiError?e.status:500,headers:{'Cache-Control':'no-store'}});}
export function textField(v:unknown,max:number,required=true){if(typeof v!=='string')throw new ApiError(400,'Invalid text.');const s=v.trim();if((required&&!s)||s.length>max)throw new ApiError(400,`Text must be ${required?'1':'0'}–${max} characters.`);return s;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ApiError(403,'This request must come from Rush Social.');}
