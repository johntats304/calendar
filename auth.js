/* Talks to the Netlify Function at /api so accounts + boards are shared on every PC. */
const TK='sct_token_v2';
async function api(path,method='GET',body){
  const r=await fetch(path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem(TK)||'')},body:body?JSON.stringify(body):undefined});
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(d.error||('Server error '+r.status));e.status=r.status;throw e}
  return d;
}
async function login(u,p){const d=await api('/api/login','POST',{username:u,password:p});localStorage.setItem(TK,d.token);return d.user}
async function currentUser(){try{return await api('/api/me')}catch(e){return null}} // {user,board} or null
async function logout(){try{await api('/api/logout','POST')}catch(e){}localStorage.removeItem(TK);location.href='login.html'}
