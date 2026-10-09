const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const DB={prepare(query){let args=[];return {bind(...v){args=v;return this;},async run(){const r=sql.prepare(query).run(...args);return{success:true,meta:r};},async all(){return{results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)||null;}};},async batch(queries){sql.exec('BEGIN');try{const result=[];for(const q of queries)result.push(await q.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const files=new Map(),BUCKET={async put(id,data,meta){files.set(id,{data,meta});},async get(id){const f=files.get(id);return f?{body:f.data,httpMetadata:f.meta.httpMetadata}:null;},async delete(id){files.delete(id);}};
const names={alice:'Alice',bob:'Bob',eve:'Eve'},trades={alice:[{id:'trade-1',symbol:'NVDA',side:'SELL',shares:5,price:50,total:250,pnl:20,time:'2026-10-09T12:00:00Z'}],bob:[{id:'trade-2',symbol:'AAPL',side:'BUY',shares:2,price:150,total:300,pnl:null,time:'2026-10-09T12:01:00Z'}],eve:[]};
async function gameFetch(url,opt){const token=opt.headers.Authorization.slice(7);if(!names[token])return Response.json({},{status:401});if(url.endsWith('/auth/v1/user'))return Response.json({id:token});if(url.endsWith('mr_me'))return Response.json({player:{name:names[token],cash:1000},trades:trades[token]});if(url.endsWith('mr_profile')){const n=JSON.parse(opt.body).p_name;return Response.json({name:n,worth:n==='Alice'?1250:2000,cash:1000,rank:n==='Alice'?2:1,trades:trades[Object.keys(names).find(k=>names[k]===n)]||[]});}if(url.endsWith('mr_leaderboard'))return Response.json({players:2,top:[{name:'Bob',worth:2000,rank:1},{name:'Alice',worth:1250,rank:2}]});throw Error('Unexpected game endpoint '+url);}
const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const requireMock=id=>id==='cloudflare:workers'?{env:{DB,BUCKET}}:id.startsWith('.')?load(path.resolve(path.dirname(file),id)+'.ts'):require(id);vm.runInNewContext('(function(require,module,exports){'+source+'\n})',{Request,Response,Headers,URL,crypto,AbortSignal,Uint8Array,TextDecoder,Date,console,fetch:gameFetch})(requireMock,module,module.exports);return module.exports;}
const social=load('app/api/social/route.ts'),account=load('app/api/account/route.ts'),upload=load('app/api/uploads/route.ts'),image=load('app/api/images/[id]/route.ts'),comments=load('app/api/comments/route.ts');
function req(token,path,body){return new Request('https://rush.test'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,Origin:'https://rush.test','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function post(token,body){return social.POST(req(token,'/api/social',body));}
(async()=>{
assert.equal((await social.GET(req('bad','/api/social'))).status,401);
for(const who of ['alice','bob','eve'])assert.equal((await account.GET(req(who,'/api/account'))).status,200);
const a=await(await account.GET(req('alice','/api/account'))).json();assert.equal(a.profile.worth,'1250');assert.equal(a.profile.rank,2);
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);const up=await upload.POST(new Request('https://rush.test/api/uploads',{method:'POST',headers:{Authorization:'Bearer alice',Origin:'https://rush.test','Content-Type':'image/png'},body:png}));assert.equal(up.status,201);const {id:avatarId}=await up.json();
assert.equal((await account.POST(req('bob','/api/account',{bio:'Thief',avatarId}))).status,403);
assert.equal((await account.POST(req('alice','/api/account',{bio:'Hello rush',avatarId}))).status,200);
assert.equal((await image.GET(req('bob','/api/images/'+avatarId),{params:Promise.resolve({id:avatarId})})).status,200);
assert.equal((await post('bob',{action:'create',kind:'trade',content:'Fake',tradeId:'trade-1'})).status,400);
const result=await post('alice',{action:'create',kind:'trade',content:'Big win',tradeId:'trade-1'});assert.equal(result.status,201);const {id:postId}=await result.json();
assert.equal((await post('bob',{action:'delete',postId})).status,403);
for(let i=0;i<2;i++)assert.equal((await post('bob',{action:'like',postId,liked:true})).status,200);
assert.equal((await post('bob',{action:'comment',postId,content:'Nice trade!'})).status,201);
const feed=await(await social.GET(req('alice','/api/social'))).json();assert.equal(feed.posts[0].likes,1);assert.equal(feed.posts[0].comments,1);assert.equal(JSON.parse(feed.posts[0].trade_json).total,250);assert.equal(feed.posts[0].avatar_id,avatarId);assert.equal(feed.posts[0].worth,'1250');
const replies=await(await comments.GET(req('alice','/api/comments?postId='+postId))).json();assert.equal(replies.comments[0].author,'Bob');
assert.equal((await post('alice',{action:'delete',postId})).status,200);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM comments').get().n,0);
const svg=await upload.POST(new Request('https://rush.test/api/uploads',{method:'POST',headers:{Authorization:'Bearer alice',Origin:'https://rush.test'},body:'<svg></svg>'}));assert.equal(svg.status,400);
const dm=load('app/api/messages/route.ts'),activity=load('app/api/activity/route.ts');
assert.equal((await dm.POST(req('alice','/api/messages',{peer:'bob',content:'Private hello'}))).status,201);
const bobInbox=await(await dm.GET(req('bob','/api/messages?peer=alice'))).json();assert.equal(bobInbox.messages[0].content,'Private hello');
const eveInbox=await(await dm.GET(req('eve','/api/messages?peer=alice'))).json();assert.equal(eveInbox.messages.length,0);
await dm.POST(req('eve','/api/messages',{action:'read',peer:'alice'}));assert.equal(sql.prepare('SELECT read_at FROM messages').get().read_at,null);
await dm.POST(req('bob','/api/messages',{action:'read',peer:'alice'}));assert(sql.prepare('SELECT read_at FROM messages').get().read_at);
assert.equal((await dm.POST(req('alice','/api/messages',{peer:'missing',content:'Hello'}))).status,404);
const collected=await(await activity.GET(req('alice','/api/activity'))).json();assert.equal(collected.stats.trades,2);assert.equal(collected.activity[0].trader,'Bob');
await activity.GET(req('bob','/api/activity'));assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM trade_activity').get().n,2);
const buys=await(await activity.GET(req('alice','/api/activity?side=BUY'))).json();assert.equal(buys.activity.length,1);assert.equal(buys.activity[0].side,'BUY');
console.log('PASS: private DM isolation, read permissions, trade aggregation and deduplication; real SQLite schema, auth rejection, live profile stats, image ownership, avatar visibility, verified trade ownership, idempotent likes, comments, author-only deletion, upload format checks.');
})().catch(e=>{console.error(e);process.exitCode=1;});
