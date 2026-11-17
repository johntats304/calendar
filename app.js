const $=s=>document.querySelector(s),ME=currentUser()||{id:'none',role:'user'};
const K='smart_calendar_taskboard_v1_'+ME.id; // each user has their own boards
if(ME.id==='u_admin'&&!localStorage.getItem(K)&&localStorage.getItem('smart_calendar_taskboard_v1'))localStorage.setItem(K,localStorage.getItem('smart_calendar_taskboard_v1'));
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLORS={Now:['#cbfec9','#ebd3ff','#dfc3ff'],Next:['#fff3a1','#c3e2ff'],Later:['#ffd1ea','#cbfec9']};
let S;try{S=JSON.parse(localStorage.getItem(K))}catch(e){}
S=S||{tasks:[],theme:'white'};
const save=()=>localStorage.setItem(K,JSON.stringify(S));
const pad=n=>String(n).padStart(2,'0');
const key=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const todayStr=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const d=document.createElement('div');d.textContent=m;$('#toast').append(d);setTimeout(()=>d.remove(),2500)};

/* ---------- Philippine holidays (common list; movable/Islamic ones need yearly proclamation) ---------- */
const hCache={};
function holidays(y){
  if(hCache[y])return hCache[y];
  const h={},add=(m,d,n)=>h[key(y,m-1,d)]=n;
  add(1,1,"New Year's Day");add(2,25,'EDSA Revolution Anniv.');add(4,9,'Araw ng Kagitingan');
  add(5,1,'Labor Day');add(6,12,'Independence Day');add(8,21,'Ninoy Aquino Day');
  add(11,1,"All Saints' Day");add(11,2,"All Souls' Day");add(11,30,'Bonifacio Day');
  add(12,8,'Immaculate Conception');add(12,24,'Christmas Eve');add(12,25,'Christmas Day');
  add(12,30,'Rizal Day');add(12,31,"New Year's Eve");
  const cny={2026:[2,17],2027:[2,6],2028:[1,26]};if(cny[y])add(cny[y][0],cny[y][1],'Chinese New Year');
  const d=new Date(Date.UTC(y,7,31));while(d.getUTCDay()!==1)d.setUTCDate(d.getUTCDate()-1);
  add(8,d.getUTCDate(),'National Heroes Day');
  // Easter (Gregorian) -> Holy Week
  const a=y%19,b=Math.floor(y/100),c=y%100,dd=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
  hh=(19*a+b-dd-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-hh-k)%7,m=Math.floor((a+11*hh+22*l)/451),
  mo=Math.floor((hh+l-7*m+114)/31),da=((hh+l-7*m+114)%31)+1;
  [[-3,'Maundy Thursday'],[-2,'Good Friday'],[-1,'Black Saturday'],[0,'Easter Sunday']].forEach(([o,n])=>{
    const t=new Date(Date.UTC(y,mo-1,da+o));add(t.getUTCMonth()+1,t.getUTCDate(),n)});
  return hCache[y]=h;
}

/* ---------- state ---------- */
const t0=todayStr().split('-').map(Number);
let vy=t0[0],vm=t0[1]-1,openDate=null,view='board',editId=null,dragId=null;
const act=d=>S.tasks.filter(t=>t.date===d&&t.status==='active');
const sortAct=l=>l.slice().sort((a,b)=>(b.pinned-a.pinned)||0);

/* ---------- calendar ---------- */
function renderCal(){
  $('#monthTitle').textContent=`${MONTHS[vm]} ${vy}`;
  const first=new Date(vy,vm,1).getDay(),dim=new Date(vy,vm+1,0).getDate(),tds=todayStr(),H=holidays(vy);
  let out='';
  for(let i=0;i<first;i++)out+='<div></div>';
  for(let d=1;d<=dim;d++){
    const k=key(vy,vm,d),list=sortAct(act(k)),hol=H[k];
    out+=`<button class="cell${hol?' hol':''}${k===tds?' tdy':''}" data-d="${k}">
      <span class="n"><span>${d}</span>${list.length?`<em>${list.length}</em>`:''}</span>
      ${hol?`<span class="h">${esc(hol)}</span>`:''}
      ${list.slice(0,2).map(t=>`<span class="chip" style="background:${t.color}">${esc(t.title)}</span>`).join('')}
      ${list.length>2?`<span class="h">+${list.length-2} more</span>`:''}</button>`;
  }
  $('#days').innerHTML=out;
  const A=S.tasks.filter(t=>t.status==='active');
  $('#sActive').textContent=A.length;
  $('#sDone').textContent=S.tasks.filter(t=>t.status==='done').length;
  $('#sOver').textContent=A.filter(t=>t.date<tds).length;
}
$('#days').onclick=e=>{const c=e.target.closest('.cell');if(c)openBoard(c.dataset.d)};
$('#prev').onclick=()=>{vm--;if(vm<0){vm=11;vy--}renderCal()};
$('#next').onclick=()=>{vm++;if(vm>11){vm=0;vy++}renderCal()};
$('#goToday').onclick=()=>{vy=t0[0];vm=t0[1]-1;renderCal()};

/* ---------- board modal ---------- */
function openBoard(d){openDate=d;view='board';editId=null;$('#modal').hidden=false;renderBoard()}
function closeBoard(){$('#modal').hidden=true;openDate=null;renderCal()}
$('#bClose').onclick=closeBoard;
$('#modal').onclick=e=>{if(e.target.id==='modal')closeBoard()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openDate)closeBoard()});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{view=b.dataset.v;editId=null;renderBoard()});

function renderBoard(){
  const [y,m,d]=openDate.split('-').map(Number);
  $('#bTitle').textContent=new Date(y,m-1,d).toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  $('#bHol').textContent=holidays(y)[openDate]?'🇵🇭 '+holidays(y)[openDate]:'';
  const mine=s=>S.tasks.filter(t=>t.date===openDate&&t.status===s);
  $('#cDone').textContent=mine('done').length;$('#cTrash').textContent=mine('trash').length;
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  const B=$('#bBody');
  if(view==='board'){
    B.innerHTML=`<div class="add">
      <input id="nTitle" placeholder="What needs to be done? (Enter to add)">
      <input id="nDesc" placeholder="Description (optional)">
      <select id="nPri"><option value="Now">🔴 Now</option><option value="Next">🟡 Next</option><option value="Later">🟢 Later</option></select>
      <button class="btn pri" id="nAdd">＋ Add</button></div>
      <div class="cols">${['Now','Next','Later'].map(p=>{const l=sortAct(act(openDate).filter(t=>t.priority===p));
        return `<div class="col ${p}" data-p="${p}"><h3>${p} <small>${l.length}</small></h3><div class="list">${l.length?l.map(noteHTML).join(''):'<div class="empty">No sticky notes</div>'}</div></div>`}).join('')}</div>
      <div class="zones"><div class="zone t" data-z="trash"><b>🗑</b>Trash</div><div class="zone c" data-z="done"><b>✔</b>Complete</div></div>`;
    $('#nAdd').onclick=addTask;$('#nTitle').onkeydown=e=>{if(e.key==='Enter')addTask()};
    wireDrag();
  }else{
    const l=mine(view);
    B.innerHTML=l.length?l.map(t=>`<div class="item"><div><h4>${esc(t.title)}</h4><small>${esc(t.description)} · ${t.priority}</small></div>
      <div class="nact"><button data-a="restore" data-id="${t.id}">↩ Restore</button>
      ${view==='done'?`<button data-a="trash" data-id="${t.id}">🗑 Trash</button>`:`<button data-a="erase" data-id="${t.id}">❌ Erase</button>`}</div></div>`).join('')
      :`<div class="empty">${view==='done'?'Nothing completed on this date yet 🎉':'Trash is empty ♻️'}</div>`;
  }
}
function noteHTML(t){
  const edit=editId===t.id;
  return `<div class="note" draggable="true" data-id="${t.id}" style="background:${t.color}"><div class="tape"></div>
  ${edit?`<input class="eT" value="${esc(t.title)}"><textarea class="eD" rows="2">${esc(t.description)}</textarea>
    <div class="nact"><button data-a="cancel">Cancel</button><span class="sp"></span><button data-a="save" data-id="${t.id}">💾 Save</button></div>`
  :`<h4>${esc(t.title)}</h4>${t.description?`<p>${esc(t.description)}</p>`:''}
    <div class="nact"><button data-a="pin" data-id="${t.id}">${t.pinned?'📌':'📍'}</button><button data-a="fav" data-id="${t.id}">${t.favorite?'⭐':'☆'}</button>
    <button data-a="edit" data-id="${t.id}">✏️</button><span class="sp"></span>
    <button data-a="done" data-id="${t.id}" title="Complete">✔</button><button data-a="trash" data-id="${t.id}" title="Trash">🗑</button></div>`}</div>`;
}
function addTask(){
  const title=$('#nTitle').value.trim();if(!title)return toast('Please type a task title!');
  const p=$('#nPri').value,pal=COLORS[p];
  S.tasks.push({id:'t'+Date.now(),date:openDate,title,description:$('#nDesc').value.trim(),priority:p,status:'active',pinned:false,favorite:false,color:pal[S.tasks.length%pal.length],created:todayStr()});
  save();toast('Task added');renderBoard();
}
const find=id=>S.tasks.find(t=>t.id===id);
$('#bBody').onclick=e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const t=find(b.dataset.id),a=b.dataset.a;
  if(a==='cancel'){editId=null}
  else if(!t)return;
  else if(a==='edit'){editId=t.id}
  else if(a==='save'){const n=b.closest('.note').querySelector('.eT').value.trim();if(!n)return toast('Title cannot be empty');
    t.title=n;t.description=b.closest('.note').querySelector('.eD').value.trim();editId=null}
  else if(a==='pin')t.pinned=!t.pinned;
  else if(a==='fav')t.favorite=!t.favorite;
  else if(a==='done'){t.status='done';t.completed=todayStr();toast('Checked off ✔')}
  else if(a==='trash'){t.status='trash';toast('Moved to Trash')}
  else if(a==='restore'){t.status='active';toast('Restored to board')}
  else if(a==='erase'){S.tasks=S.tasks.filter(x=>x!==t);toast('Erased')}
  save();renderBoard();
};

/* ---------- drag & drop (columns, Complete, Trash) ---------- */
function wireDrag(){
  const B=$('#bBody');
  B.querySelectorAll('.note').forEach(n=>{
    n.ondragstart=e=>{dragId=n.dataset.id;n.classList.add('drag');e.dataTransfer.setData('text/plain',dragId)};
    n.ondragend=()=>{n.classList.remove('drag');dragId=null};
  });
  B.querySelectorAll('.col,.zone').forEach(z=>{
    z.ondragover=e=>{e.preventDefault();z.classList.add('over')};
    z.ondragleave=()=>z.classList.remove('over');
    z.ondrop=e=>{e.preventDefault();z.classList.remove('over');
      const t=find(e.dataTransfer.getData('text/plain')||dragId);if(!t)return;
      if(z.dataset.z==='done'){t.status='done';t.completed=todayStr();toast('Checked off ✔')}
      else if(z.dataset.z==='trash'){t.status='trash';toast('Moved to Trash')}
      else{t.priority=z.dataset.p;toast('Moved to '+t.priority)}
      save();renderBoard()};
  });
}

/* ---------- themes & backup ---------- */
function setTheme(t){S.theme=t;document.body.className='th-'+t;save()}
document.querySelectorAll('.sw').forEach(b=>b.onclick=()=>setTheme(b.dataset.th));
$('#btnExport').onclick=()=>{const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));
  a.download=`Calendar_Taskboard_Backup_${todayStr()}.json`;a.click();toast('Backup saved')};
$('#btnImport').onclick=()=>$('#fileImport').click();
$('#fileImport').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const p=JSON.parse(r.result);if(!Array.isArray(p.tasks))throw 0;S=p;save();$('#who').innerHTML=`<b style="font-size:.75rem">${esc(ME.name||ME.username)}</b>${ME.role}`;$('#usersLink').hidden=ME.role!=='admin';
setTheme(S.theme||'white');renderCal();toast('Backup imported')}catch(x){toast('Invalid backup file')}};
  r.readAsText(f);e.target.value=''};

/* ---------- first run: sample tasks on today's date ---------- */
if(ME.role==='admin'&&!S.tasks.length&&!S.seeded){S.seeded=1;const d=todayStr();
  S.tasks=[['Call ricardo magsacay','Discuss pending collections','Now','#ebd3ff'],['Send follow-up emails','Contact all billing addresses','Next','#c3e2ff'],['Update contact list','Sync files to cloud','Later','#ffd1ea']]
  .map((x,i)=>({id:'seed'+i,date:d,title:x[0],description:x[1],priority:x[2],status:'active',pinned:false,favorite:false,color:x[3],created:d}));save()}
$('#who').innerHTML=`<b style="font-size:.75rem">${esc(ME.name||ME.username)}</b>${ME.role}`;$('#usersLink').hidden=ME.role!=='admin';
setTheme(S.theme||'white');renderCal();
