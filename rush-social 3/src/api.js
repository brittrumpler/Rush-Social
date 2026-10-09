// Uses the same GoTrue auth and Market Rush RPC contracts as the supplied game.
export class LiveAPI {
  constructor(config){this.config=config;this.session=null;this.user=null;this.refreshing=null;try{this.session=JSON.parse(localStorage.getItem('rush.session'));}catch{}this.user=this.session?.user;}
  async request(path,{method='GET',body,headers={},auth=true}={}){
    if(auth&&this.session&&this.session.expires_at<Date.now()/1000+60) await this.refresh();
    const run=()=>fetch(`${this.config.supabaseUrl}${path}`,{method,headers:{apikey:this.config.supabasePublishableKey,...(auth&&this.session?{Authorization:`Bearer ${this.session.access_token}`}:{ }),...(body instanceof Blob?{}:{'Content-Type':'application/json'}),...headers},body:body==null?undefined:body instanceof Blob?body:JSON.stringify(body)});
    let response=await run();if(response.status===401&&auth&&this.session){await this.refresh();response=await run();}
    const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Unexpected server response.');}
    if(!response.ok)throw Error(data?.message||data?.error_description||data?.msg||'Request failed. Please try again.');return data;
  }
  store(session){this.session=session?{...session,expires_at:session.expires_at||Math.floor(Date.now()/1000)+session.expires_in}:null;this.user=this.session?.user;if(session)localStorage.setItem('rush.session',JSON.stringify(this.session));else localStorage.removeItem('rush.session');}
  async refresh(){if(!this.refreshing)this.refreshing=(async()=>{try{this.store(await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:this.session.refresh_token}}));}catch{this.store(null);throw Error('Your session expired. Please sign in again.');}finally{this.refreshing=null;}})();return this.refreshing;}
  async signIn(email,password){this.store(await this.request('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email,password}}));return this.init();}
  rpc(name,body={}){return this.request(`/rest/v1/rpc/${name}`,{method:'POST',body});}
  async init(){if(!this.user)return null;return this.rpc('rs_ensure_profile');}
  async feed(offset=0){return this.rpc('rs_feed',{p_offset:offset,p_limit:30});}
  leaderboard(){return this.rpc('mr_leaderboard');}
  async profile(name){const [game,social]=await Promise.all([this.rpc('mr_profile',{p_name:name}),this.request(`/rest/v1/rs_profiles?name=eq.${encodeURIComponent(name)}&select=*`)]);return {...game,...social[0]};}
  post(body,kind,image_url){return this.request('/rest/v1/rs_posts',{method:'POST',body:{author_id:this.user.id,body,kind,image_url}});}
  like(id){return this.rpc('rs_toggle_like',{p_post_id:id});}
  comments(id){return this.request(`/rest/v1/rs_comments?post_id=eq.${encodeURIComponent(id)}&select=*,author:rs_profiles(*)&order=created_at.asc&limit=100`);}
  comment(id,body){return this.request('/rest/v1/rs_comments',{method:'POST',body:{post_id:id,author_id:this.user.id,body}});}
  updateProfile(values){return this.request(`/rest/v1/rs_profiles?id=eq.${this.user.id}`,{method:'PATCH',body:values});}
  deletePost(id){return this.request(`/rest/v1/rs_posts?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});}
  async upload(file,type='posts'){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=`${this.user.id}/${type}/${crypto.randomUUID()}.${ext}`;await this.request(`/storage/v1/object/rush-media/${path}`,{method:'POST',body:file,headers:{'Content-Type':file.type,'Cache-Control':'3600'}});return `${this.config.supabaseUrl}/storage/v1/object/public/rush-media/${path}`;}
  async signOut(){try{await this.request('/auth/v1/logout',{method:'POST'});}finally{this.store(null);}}
}
