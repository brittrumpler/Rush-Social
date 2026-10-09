const ago = minutes => new Date(Date.now()-minutes*60000).toISOString();
export const demoPeople = [
{id:'alex',name:'alex',display_name:'Alex Morgan',bio:'Buying the dip. Becoming the dip. Repeat.',worth:128450.80,cash:24180.50,rank:4,avatar_url:null,color:'peach'},
{id:'maya',name:'maya_trades',display_name:'Maya Chen',bio:'A little conviction goes a long way. 📈',worth:246820.40,cash:42280,rank:1,color:'purple'},
{id:'jordan',name:'jordan',display_name:'Jordan Ellis',bio:'Probably overthinking my next trade.',worth:198640,cash:18300,rank:2,color:'blue'},
{id:'sam',name:'diamond_sam',display_name:'Sam Rivera',bio:'Here for the long game and the memes.',worth:156230,cash:32000,rank:3,color:'green'},
{id:'chris',name:'chris',display_name:'Chris Park',bio:'Professional chart enjoyer.',worth:98400,cash:11400,rank:5,color:'pink'}];
export function demoSeed(){return [
{id:'p1',author_id:'maya',kind:'post',body:'Held through the chaos. Finally paid off.\n\nSometimes the best move is doing absolutely nothing. $NVDA',trade:{symbol:'NVDA',side:'SELL',shares:120,price:142.50,total:17100,pnl:3240,pnlPct:23.38},likes:24,liked:false,created_at:ago(8),comments:[]},
{id:'p2',author_id:'sam',kind:'banter',body:'Me: I’m going to make smart, calculated trades today.\n\nAlso me, 4 minutes later:',meme:true,likes:38,liked:false,created_at:ago(23),comments:[{id:'c1',author_id:'jordan',body:'The group chat is a terrible financial advisor 😂',created_at:ago(18)}]},
{id:'p3',author_id:'jordan',kind:'trade',body:'',trade:{symbol:'AAPL',side:'BUY',shares:50,price:212.40,total:10620,pnl:null},likes:8,liked:false,created_at:ago(31),comments:[]},
{id:'p4',author_id:'chris',kind:'post',body:'Hot take: the real portfolio was the friends we made along the way.\n\nAnyway I’m down $2,400.',likes:19,liked:false,created_at:ago(45),comments:[]},
{id:'p5',author_id:'alex',kind:'trade',body:'',trade:{symbol:'TSLA',side:'SELL',shares:30,price:258.90,total:7767,pnl:891,pnlPct:12.96},likes:12,liked:false,created_at:ago(61),comments:[]},
{id:'p6',author_id:'maya',kind:'trade',body:'',trade:{symbol:'NVDA',side:'BUY',shares:25,price:139.20,total:3480,pnl:null},likes:6,liked:false,created_at:ago(78),comments:[]}
];}
export class DemoAPI {
  constructor(){this.user={id:'alex'};this.people=structuredClone(demoPeople);this.posts=demoSeed(); try{const data=JSON.parse(localStorage.getItem('rush.demo.v1'));if(data){this.people=data.people;this.posts=data.posts;}}catch{} }
  save(){try{localStorage.setItem('rush.demo.v1',JSON.stringify({people:this.people,posts:this.posts}));}catch{throw Error('Browser storage is full. Try a smaller image.');}}
  async init(){return this.people.find(p=>p.id==='alex');}
  async feed(offset=0){return this.posts.slice(offset,offset+30).map(p=>({...p,author:this.people.find(a=>a.id===p.author_id)}));}
  async leaderboard(){return {top:[...this.people].sort((a,b)=>a.rank-b.rank),players:5};}
  async profile(name){return this.people.find(p=>p.name===name);}
  async post(body,kind,image_url){this.posts.unshift({id:crypto.randomUUID(),author_id:'alex',body,kind,image_url,likes:0,liked:false,created_at:new Date().toISOString(),comments:[]});this.save();}
  async like(id){const p=this.posts.find(p=>p.id===id);p.liked=!p.liked;p.likes+=p.liked?1:-1;this.save();}
  async comments(id){return this.posts.find(p=>p.id===id).comments.map(c=>({...c,author:this.people.find(p=>p.id===c.author_id)}));}
  async comment(id,body){this.posts.find(p=>p.id===id).comments.push({id:crypto.randomUUID(),author_id:'alex',body,created_at:new Date().toISOString()});this.save();}
  async updateProfile(values){Object.assign(this.people.find(p=>p.id==='alex'),values);this.save();}
  async upload(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read the image.'));r.readAsDataURL(file);});}
  async deletePost(id){this.posts=this.posts.filter(p=>p.id!==id);this.save();}
  async signOut(){}
}
