export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = value => value == null || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value));
export const compactMoney = value => value == null ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(Number(value));
export function safeImage(url) { try { const u = new URL(url, globalThis.location?.href || 'https://localhost'); return u.protocol === 'https:' || u.protocol === 'http:' && u.hostname === 'localhost' || /^data:image\/(png|jpeg|webp);base64,/.test(url) ? escapeHTML(url) : ''; } catch { return ''; } }
export function filterPosts(posts,{filter='all',query='',sort='latest',bookmarks=[],view='home',userId}={}) {
  const q=query.toLowerCase().trim();
  return posts.filter(p => (filter==='all'||(filter==='trades'?p.kind==='trade':p.kind==='banter')) && (view!=='bookmarks'||bookmarks.includes(p.id)) && (view!=='profile'||p.author_id===userId) && (!q||`${p.body} ${p.author?.name} ${p.trade?.symbol||''}`.toLowerCase().includes(q))).sort((a,b)=>sort==='popular'?(b.likes-a.likes)||new Date(b.created_at)-new Date(a.created_at):new Date(b.created_at)-new Date(a.created_at));
}
export function validateText(text,max=1000) { const value=text.trim(); if(!value) throw Error('Write something first.'); if(value.length>max) throw Error(`Keep it under ${max} characters.`); return value; }
export function validateImage(file) { if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Choose a JPG, PNG, or WebP image.'); if(file.size>5*1024*1024) throw Error('Choose an image smaller than 5 MB.'); return file; }
export function relativeTime(date) { const minutes=Math.max(0,Math.floor((Date.now()-new Date(date))/60000)); return minutes<1?'just now':minutes<60?`${minutes}m`:minutes<1440?`${Math.floor(minutes/60)}h`:`${Math.floor(minutes/1440)}d`; }
