/* Client-side auth for a static site: users live in this browser's localStorage. */
const UK='sct_users_v1',SK='sct_session_v1';
const getUsers=()=>{try{return JSON.parse(localStorage.getItem(UK))||[]}catch(e){return[]}};
const saveUsers=u=>localStorage.setItem(UK,JSON.stringify(u));
const rid=()=>[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hashPw(pw,salt){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pw));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function makeUser(username,name,pw,role,extra){
  const salt=rid();
  return Object.assign({id:'u_'+rid(),username:username.trim().toLowerCase(),name:name.trim()||username.trim(),role,active:true,salt,hash:await hashPw(pw,salt),created:new Date().toISOString().slice(0,10)},extra);
}
/* Default admin: admin / admin123 (must change it after first login) */
async function ensureAdmin(){
  if(getUsers().length)return;
  const a=await makeUser('admin','Administrator','admin123','admin',{mustChange:true});
  a.id='u_admin';saveUsers([a]);
}
function currentUser(){
  try{const s=JSON.parse(localStorage.getItem(SK));
    const u=getUsers().find(x=>x.id===s.id&&x.active);return u||null}catch(e){return null}
}
async function login(username,pw){
  await ensureAdmin();
  const u=getUsers().find(x=>x.username===username.trim().toLowerCase());
  if(!u||!u.active||u.hash!==await hashPw(pw,u.salt))return null;
  localStorage.setItem(SK,JSON.stringify({id:u.id}));return u;
}
const logout=()=>{localStorage.removeItem(SK);location.href='login.html'};
