/* Warstwa danych notatnika: Dysk Google (folder „!Teksty”) albo tryb lokalny.
   Udaje interfejs bazy/plików, z którego korzysta aplikacja: claude.use('db' | 'assets' | 'downloads'). */
(function(){
'use strict';
const CFG=window.NT_CONFIG||{};
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){return null}};
const DRIVE='https://www.googleapis.com/drive/v3',UP='https://www.googleapis.com/upload/drive/v3',SCOPE='https://www.googleapis.com/auth/drive.file';
const MODE=CFG.clientId?'drive':'local';
/* wersja układu danych: po zmianie nazwy folderu na !Teksty wyczyść zapamiętane stare identyfikatory (stary folder „Notatnik tekstów”) */
if(ls('nt-schema')!=='3'){['nt-cache','nt-fid','nt-ver','nt-folder'].forEach(k=>ls(k,null));ls('nt-schema','3')}
const Store={map:new Map(),tomb:{},fileId:ls('nt-fid'),ver:ls('nt-ver'),folder:ls('nt-folder'),listeners:new Set(),dirty:false,seq:0,syncing:false,needsAuth:false,timer:null};
const $=s=>document.querySelector(s);

/* ---- status ---- */
function diag(t){const e=$('#diag');if(!e)return;e.hidden=!t;e.textContent=t||''}
window.addEventListener('error',e=>diag('Błąd w aplikacji: '+(e.message||'nieznany')));
window.addEventListener('unhandledrejection',e=>diag('Błąd w aplikacji: '+((e.reason&&e.reason.message)||e.reason||'nieznany')));
function status(text,cls,click){const e=$('#sync');if(!e)return;e.textContent=text;e.className='syncp '+(cls||'');e.onclick=click||null;e.disabled=!click}

/* ---- cache lokalny (praca offline) ---- */
function loadCache(){try{const c=JSON.parse(ls('nt-cache')||'null');if(c){(c.teksty||[]).forEach(n=>Store.map.set(n.id,n));Store.tomb=c.usuniete||{};Store.dirty=!!c.dirty}}catch(e){}}
function saveCache(){ls('nt-cache',JSON.stringify({teksty:[...Store.map.values()],usuniete:Store.tomb,dirty:Store.dirty}))}
function docOut(){return {v:1,teksty:[...Store.map.values()],usuniete:Store.tomb}}

/* ---- zmiany dla aplikacji (jak onSnapshot) ---- */
function snapNow(){const docs=[...Store.map.values()].map(n=>({id:n.id,exists:true,data:()=>{const o={...n};delete o.id;return o}}));return {docs,size:docs.length,empty:!docs.length}}
function emit(){const s=snapNow();Store.listeners.forEach(cb=>{try{cb(s)}catch(e){console.error(e)}})}

/* ---- scalanie dwóch wersji (najnowsza zmiana wygrywa, usunięcia pamiętane) ---- */
function merge(remote){let changed=false;const rt=remote.usuniete||{};
  for(const [id,ts] of Object.entries(rt)){if((Store.tomb[id]||0)<ts)Store.tomb[id]=ts}
  (remote.teksty||[]).forEach(r=>{const l=Store.map.get(r.id),t=Store.tomb[r.id];if(t&&t>=(r.zmieniono||0))return;
    if(!l||(r.zmieniono||0)>(l.zmieniono||0)){Store.map.set(r.id,r);changed=true}});
  for(const [id,n] of [...Store.map]){const t=Store.tomb[id];if(t&&t>=(n.zmieniono||0)){Store.map.delete(id);changed=true}}
  return changed}

/* ---- logowanie Google (token na ok. godzinę) ---- */
const Auth={tok:null,exp:0,client:null,_res:null,_rej:null,
  valid(){return !!this.tok&&this.exp>Date.now()+30000},
  request(prompt){return new Promise((res,rej)=>{
    if(!window.google||!google.accounts||!google.accounts.oauth2)return rej(new Error('Brak połączenia z Google (offline?)'));
    if(!this.client)this.client=google.accounts.oauth2.initTokenClient({client_id:CFG.clientId,scope:SCOPE,
      callback:r=>{if(r.error){this._rej&&this._rej(r);return}
        if(google.accounts.oauth2.hasGrantedAllScopes&&!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE)){this._rej&&this._rej({error:'brak_uprawnien'});return}
        this.tok=r.access_token;this.exp=Date.now()+(r.expires_in-60)*1000;ls('nt-tok',JSON.stringify({t:this.tok,exp:this.exp}));this._res&&this._res(this.tok)},
      error_callback:e=>this._rej&&this._rej(e)});
    this._res=res;this._rej=rej;this.client.requestAccessToken({prompt:prompt||''})})}};
try{const s=JSON.parse(ls('nt-tok')||'null');if(s&&s.exp>Date.now()+60000){Auth.tok=s.t;Auth.exp=s.exp}}catch(e){}
function authErr(){const e=new Error('auth');e.auth=true;return e}
async function gfetch(url,opt){opt=opt||{};if(!Auth.valid())throw authErr();
  const r=await fetch(url,{...opt,headers:{...(opt.headers||{}),Authorization:'Bearer '+Auth.tok}});
  if(r.status===401){Auth.tok=null;ls('nt-tok',null);throw authErr()}
  if(!r.ok){const tx=await r.text();throw new Error('Dysk '+r.status+': '+tx.slice(0,140))}return r}
const BLAD={brak_uprawnien:'Nie zaznaczyłeś uprawnienia do plików na Dysku. Zaloguj ponownie i zostaw zaznaczone pole „Wyświetlaj i zarządzaj plikami utworzonymi przez tę aplikację”.',
  popup_failed_to_open:'Przeglądarka zablokowała okienko logowania Google. Wyłącz blokowanie wyskakujących okien (iPhone: Ustawienia → Safari → Blokuj wyskakujące okna) i spróbuj ponownie.',
  popup_closed:'Okienko logowania zostało zamknięte przed zakończeniem. Spróbuj jeszcze raz i dokończ logowanie.',
  access_denied:'Google odmówiło dostępu. Sprawdź, czy logujesz się kontem dodanym jako użytkownik testowy (svvveri@gmail.com).'};
function blad(e){const k=e&&(e.type||e.error);return BLAD[k]||('Nie udało się zalogować ('+(k||(e&&e.message)||'błąd')+').')}
async function connect(){status('☁ łączę…','');
  try{await Auth.request(Auth.neverOk?'consent':'');Auth.neverOk=false;Store.needsAuth=false;hideLogin();diag('');await syncNow(true)}
  catch(e){Auth.neverOk=true;showLogin(blad(e));diag(blad(e));status('☁ połącz z Dyskiem','warn',connect)}}
function showLogin(msg){const l=$('#login');if(l){l.hidden=false;const m=$('#loginMsg');if(m&&msg)m.textContent=msg}}
function hideLogin(){const l=$('#login');if(l)l.hidden=true}
function needLogin(){Store.needsAuth=true;diag(Store.map.size?'':'Nie jesteś zalogowany do Dysku Google. Dotknij „☁ połącz z Dyskiem” po prawej, żeby zobaczyć teksty.');status('☁ połącz z Dyskiem','warn',connect);if(!Store.map.size&&!Store.fileId)showLogin()}

/* ---- Dysk: folder i plik z tekstami ---- */
async function ensureFolder(){if(Store.folder)return Store.folder;
  const q="name='!Teksty' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  let r=await (await gfetch(DRIVE+'/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=5')).json();
  let id=r.files&&r.files[0]&&r.files[0].id;
  if(!id){r=await (await gfetch(DRIVE+'/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'!Teksty',mimeType:'application/vnd.google-apps.folder'})})).json();id=r.id}
  Store.folder=id;ls('nt-folder',id);return id}
async function findData(){const f=await ensureFolder();
  const q="name='teksty.json' and '"+f+"' in parents and trashed=false";
  const r=await (await gfetch(DRIVE+'/files?q='+encodeURIComponent(q)+'&fields=files(id,version)&pageSize=2')).json();
  return (r.files&&r.files[0])||null}
function multipart(meta,body,type){const b='ntb'+Math.random().toString(36).slice(2);
  return {type:'multipart/related; boundary='+b,body:new Blob(['--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+b+'\r\nContent-Type: '+type+'\r\n\r\n',body,'\r\n--'+b+'--'])}}
async function createData(){const f=await ensureFolder(),m=multipart({name:'teksty.json',parents:[f]},JSON.stringify(docOut()),'application/json');
  const r=await (await gfetch(UP+'/files?uploadType=multipart&fields=id,version',{method:'POST',headers:{'Content-Type':m.type},body:m.body})).json();
  Store.fileId=r.id;Store.ver=r.version;ls('nt-fid',r.id);ls('nt-ver',r.version)}
async function pushData(){const seq=Store.seq;
  const r=await (await gfetch(UP+'/files/'+Store.fileId+'?uploadType=media&fields=version',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(docOut())})).json();
  Store.ver=r.version;ls('nt-ver',r.version);if(Store.seq===seq){Store.dirty=false}saveCache()}

async function syncNow(manual){
  if(MODE!=='drive'||Store.syncing)return;
  if(!Auth.valid()){needLogin();return}
  Store.syncing=true;status('☁ synchronizuję…','');
  try{
    const f=await findData();
    if(f){
      Store.fileId=f.id;ls('nt-fid',f.id);
      const remote=await (await gfetch(DRIVE+'/files/'+f.id+'?alt=media')).json();
      const changed=merge(remote);
      if(Store.dirty||(Store.map.size&&remote.teksty&&remote.teksty.length!==Store.map.size)){await pushData()}else{Store.ver=f.version;ls('nt-ver',f.version)}
      if(changed){saveCache();emit()}
    }else{await createData();Store.dirty=false;saveCache()}
    Store.needsAuth=false;status('☁ zapisano '+new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}),'ok');diag(Store.map.size?'':'Połączono z Dyskiem, ale folder „!Teksty” jest pusty. Jeśli tu powinny być teksty, sprawdź, czy logujesz się tym samym kontem Google co na komputerze.')
  }catch(e){
    if(e&&e.auth)needLogin();else{status('☁ błąd, ponowię','warn',()=>syncNow(true));diag('Błąd połączenia z Dyskiem: '+(e&&e.message||'nieznany')+'. Dotknij „☁ błąd” po prawej, żeby spróbować ponownie.')}
    console.error(e)
  }finally{Store.syncing=false}}
function schedule(){clearTimeout(Store.timer);status('☁ czeka na zapis…','');Store.timer=setTimeout(()=>syncNow(),1500)}
async function poll(){if(MODE!=='drive'||document.hidden||Store.syncing||Store.dirty||!Store.fileId||!Auth.valid())return;
  try{const r=await (await gfetch(DRIVE+'/files/'+Store.fileId+'?fields=version')).json();if(String(r.version)!==String(Store.ver))syncNow()}catch(e){if(e&&e.auth)needLogin()}}

/* ---- zapis lokalny dokumentu ---- */
function write(id,d){Store.map.set(id,{...d,id});delete Store.tomb[id];Store.dirty=true;Store.seq++;saveCache();if(MODE==='drive')schedule();else status('tryb lokalny','warn')}
function remove(id){Store.map.delete(id);Store.tomb[id]=Date.now();Store.dirty=true;Store.seq++;saveCache();if(MODE==='drive')schedule()}
function importJSON(text){let j;try{j=JSON.parse(text)}catch(e){return -1}
  const arr=Array.isArray(j)?j:(j.teksty||[]);let n=0;
  arr.forEach(t=>{if(!t||!t.tresc&&!t.tytul)return;const id=t.id||('i'+Date.now().toString(36)+n);const cur=Store.map.get(id);
    if(!cur||(t.zmieniono||0)>(cur.zmieniono||0)){Store.map.set(id,{...t,id,tagi:t.tagi||[],nagrania:t.nagrania||[]});delete Store.tomb[id];n++}});
  Store.dirty=true;Store.seq++;saveCache();emit();if(MODE==='drive')schedule();return n}

/* ---- interfejsy dla aplikacji ---- */
const DBshim={
  collection(){const q={limit(){return q},onSnapshot(cb){Store.listeners.add(cb);setTimeout(()=>cb(snapNow()),0);return()=>Store.listeners.delete(cb)}};return q},
  doc(path){const id=String(path).split('/')[1];return {set:async d=>write(id,d),delete:async()=>remove(id)}}};
const audioCache={};
const ext=t=>/webm/.test(t)?'webm':/ogg/.test(t)?'ogg':/mpeg|mp3/.test(t)?'mp3':/wav/.test(t)?'wav':/png/.test(t)?'png':/jpe?g/.test(t)?'jpg':/heic|heif/.test(t)?'heic':/webp/.test(t)?'webp':'m4a';
const ASSETS={
  async upload(blob){const f=await ensureFolder(),type=blob.type||'audio/mp4';
    const m=multipart({name:'nagranie-'+Date.now()+'.'+ext(type),parents:[f]},blob,type);
    const r=await (await gfetch(UP+'/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':m.type},body:m.body})).json();
    return {id:r.id,url:null,sizeBytes:blob.size,contentType:type}},
  async delete(id){await gfetch(DRIVE+'/files/'+id,{method:'DELETE'})},
  async blobUrl(id){if(audioCache[id])return audioCache[id];
    const r=await gfetch(DRIVE+'/files/'+id+'?alt=media'),b=await r.blob();
    return audioCache[id]=URL.createObjectURL(new Blob([b],{type:b.type||'audio/mp4'}))}};

/* ---- zgłoszenia problemów (nt-v97): plik zgloszenia.json i załączniki zgl-<id>-<n>.<rozszerzenie> w folderze „!Teksty”.
   Na początku sesji Claude czyta je konektorem Google Drive, układa kolejność, a po rozwiązaniu wpis znika (przycisk „Usuń” w aplikacji). ---- */
const ZGL_NAME='zgloszenia.json';
async function zglFile(){const f=await ensureFolder(),q="name='"+ZGL_NAME+"' and '"+f+"' in parents and trashed=false";
  const r=await (await gfetch(DRIVE+'/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=2')).json();return (r.files&&r.files[0])||null}
async function zglRead(){const f=await zglFile();if(!f)return {id:null,lista:[]};
  const j=await (await gfetch(DRIVE+'/files/'+f.id+'?alt=media')).json();return {id:f.id,lista:Array.isArray(j.zgloszenia)?j.zgloszenia:[]}}
async function zglWrite(id,lista){const body=JSON.stringify({v:1,zgloszenia:lista});
  if(id){await gfetch(UP+'/files/'+id+'?uploadType=media&fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body});return id}
  const f=await ensureFolder(),m=multipart({name:ZGL_NAME,parents:[f]},body,'application/json');
  return (await (await gfetch(UP+'/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':m.type},body:m.body})).json()).id}
async function zglUpload(blob,nazwa){const f=await ensureFolder(),type=blob.type||'application/octet-stream',m=multipart({name:nazwa,parents:[f]},blob,type);
  return (await (await gfetch(UP+'/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':m.type},body:m.body})).json()).id}
const ZGL={
  async list(){if(MODE!=='drive')throw new Error('Zgłoszenia działają tylko z Dyskiem Google.');return (await zglRead()).lista},
  /* wpis: {funkcja, opis, kontekst, pliki:[{blob, rodzaj:'screenshot'|'glosowka', sek}]}; najpierw załączniki, dopiero potem wpis (przerwane wysyłanie nie zostawia wpisu bez plików) */
  async add(w){if(MODE!=='drive')throw new Error('Zgłoszenia działają tylko z Dyskiem Google.');
    const id='z'+Date.now().toString(36),pliki=[];let k=0;
    for(const p of (w.pliki||[])){k++;const nazwa='zgl-'+id+'-'+k+'.'+ext(p.blob.type||'');const fid=await zglUpload(p.blob,nazwa);
      pliki.push({id:fid,nazwa,typ:p.blob.type||'',rodzaj:p.rodzaj||'plik',rozmiar:p.blob.size,...(p.sek?{sek:p.sek}:{})})}
    const cur=await zglRead(),wpis={id,ts:Date.now(),funkcja:w.funkcja||'',opis:w.opis||'',kontekst:w.kontekst||{},pliki};
    cur.lista.push(wpis);await zglWrite(cur.id,cur.lista);return wpis},
  async remove(id){if(MODE!=='drive')throw new Error('Zgłoszenia działają tylko z Dyskiem Google.');
    const cur=await zglRead(),w=cur.lista.find(x=>x.id===id);if(!w)return;
    for(const p of (w.pliki||[])){try{await gfetch(DRIVE+'/files/'+p.id,{method:'DELETE'})}catch(e){if(e&&e.auth)throw e}}
    await zglWrite(cur.id,cur.lista.filter(x=>x.id!==id))}};
async function ensureAuth(){if(!Auth.valid())await Auth.request('')}
const DL={async save({filename,data}){
  const blob=data instanceof Blob?data:new Blob([data],{type:'text/plain;charset=utf-8'});
  try{const file=new File([blob],filename,{type:blob.type});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return {status:'saved'}}}catch(e){if(e&&e.name==='AbortError'){const x=new Error('declined');x.code='declined';throw x}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);return {status:'saved'}}};
window.NT={blobUrl:id=>ASSETS.blobUrl(id),importJSON,syncNow:()=>syncNow(true),mode:MODE,connect,zgl:ZGL,ensureAuth};
window.claude={use:async n=>({db:DBshim,assets:MODE==='drive'?ASSETS:null,downloads:DL})[n]||null};

/* ---- start ---- */
function init(){
  loadCache();
  document.getElementById('loginBtn')&&(document.getElementById('loginBtn').onclick=connect);
  if(MODE==='local'){status('tryb lokalny (bez Dysku)','warn');return}
  if(Auth.valid())syncNow();else needLogin();
  // po wygaśnięciu tokenu najbliższe dotknięcie odnawia logowanie
  document.addEventListener('pointerdown',()=>{if(Store.needsAuth&&!Auth.valid()&&!Store.syncing&&$('#login').hidden){Auth.request('').then(()=>{Store.needsAuth=false;syncNow(true)}).catch(()=>{})}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(Auth.valid())syncNow();else needLogin()}});
  setInterval(poll,30000);
  window.addEventListener('online',()=>syncNow());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
