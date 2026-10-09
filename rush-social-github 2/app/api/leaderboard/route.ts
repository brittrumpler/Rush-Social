import { identity,gameFetch,errorResponse } from '../../../lib/game';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const u=await identity(req);const board=await gameFetch('/rest/v1/rpc/mr_leaderboard',u.token,{});return Response.json(board,{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
