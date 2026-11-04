/* Detune extras: album-cover colour theme + lyrics (LRC / plain text). Standalone; only reads the DOM and the <audio> element. */
(()=>{"use strict";
const $=id=>document.getElementById(id),R=document.documentElement,a=$("audio"),lite=R.classList.contains("lite");
/* fx.js owns the reactive spin animation (.playing .cover). If it never initialised (offline
   cache miss / older shell version), mark <html> so CSS falls back to a plain always-spin. */
if(!window.DetuneFX)setTimeout(()=>{if(!window.DetuneFX)R.classList.add("no-fx")},1200);
const LS={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:k=>v=>{try{localStorage.setItem(k,v);return true}catch{return false}},del:k=>{try{localStorage.removeItem(k)}catch{}}};
function note(m){const t=$("toast");t.textContent=m;t.style.display="block";clearTimeout(note.t);note.t=setTimeout(()=>t.style.display="none",3000)}
/* ---------- cover theme ---------- */
const tb=$("themeBtn"),S=R.style;let on=LS.get("detune-cover-theme")==="1";
function dominant(img){const c=document.createElement("canvas");c.width=c.height=32;const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,32,32);const d=x.getImageData(0,0,32,32).data,bins=new Float32Array(36);let tw=0,ts=0;
 for(let i=0;i<d.length;i+=4){const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,df=mx-mn;if(df<.08)continue;
  let h=mx===r?((g-b)/df)%6:mx===g?(b-r)/df+2:(r-g)/df+4;h=(h*60+360)%360;const w=df*(1-Math.abs(2*l-1))+.001;bins[(h/10)|0]+=w;tw+=w;ts+=w*df/(1-Math.abs(2*l-1)+.001)}
 if(tw<1)return null;let p=0;for(let i=1;i<36;i++)if(bins[i]>bins[p])p=i;return{h:p*10+5,s:Math.min(1,ts/tw)}}
const hsl=(h,s,l)=>`hsl(${((h%360)+360)%360|0} ${Math.round(Math.min(1,s)*100)}% ${Math.round(Math.min(1,l)*100)}%)`;
const POOL_KEYS=["--blood","--blood-hi","--blood-dk","--accent","--focus","--edge","--ink","--muted","--glass","--pool0","--pool1","--pool2","--moon","--fog","--grad-a","--grad-b","--thumb-a","--thumb-b","--edge-soft","--tint-soft","--tint-strong","--glow","--glow-hi","--edge-soft","--tint-strong"];
/* Retint via CSS custom properties instead of hue-rotating the DOM (which smeared text and
   forced the fixed blood pool to stay red). The pool reads --pool0/1/2 in index.html. */
let lastHue=null;
function setTheme(h,s){
 lastHue=h;
 /* fx.js draws the waveform on a canvas (CSS vars can't reach it) — publish the cover-tinted
    stop colours as variables so the visualizer matches the album too. */
 S.setProperty("--wave-lo",hsl(h,.85,.25));S.setProperty("--wave-mid",hsl(h,.9,.5));S.setProperty("--wave-hi",hsl(h,.85,.82));S.setProperty("--wave-glow",hsl(h,.95,.55));
  S.setProperty("--blood",hsl(h,.78,.30));S.setProperty("--blood-hi",hsl(h,.92,.56));S.setProperty("--blood-dk",hsl(h,.82,.13));
  S.setProperty("--accent",hsl(h,.78,.26));S.setProperty("--focus",hsl(h,.88,.68));
  S.setProperty("--edge",hsl(h,.72,.62)+" / .2");S.setProperty("--ink",hsl(h,.28,.94));S.setProperty("--muted",hsl(h,.24,.64));
  S.setProperty("--glass",hsl(h,.55,.09)+" / .62");S.setProperty("--pool0",hsl(h,.72,.42));S.setProperty("--pool1",hsl(h,.78,.26));S.setProperty("--pool2",hsl(h,.7,.09));
  S.setProperty("--moon",hsl(h,.8,.5));S.setProperty("--fog",hsl(h,.75,.24));
  S.setProperty("--grad-a",hsl(h,.55,.95));S.setProperty("--grad-b",hsl(h,.9,.6));
  S.setProperty("--thumb-a",hsl(h,.85,.78));S.setProperty("--thumb-b",hsl(h,.85,.42));S.setProperty("--edge-soft",hsl(h,.7,.6)+" / .18");S.setProperty("--tint-strong",hsl(h,.75,.35)+" / .7");
  S.setProperty("--tint-soft",hsl(h,.8,.45)+" / .25");S.setProperty("--glow",hsl(h,.8,.5)+" / .4");S.setProperty("--glow-hi",hsl(h,.9,.6)+" / .8");
}
function clearTheme(){lastHue=null;for(const k of POOL_KEYS.concat(["--wave-lo","--wave-mid","--wave-hi","--wave-glow"]))S.removeProperty(k)}
function sync(){tb.setAttribute("aria-pressed",on);if(!on){R.classList.remove("cover-theme");clearTheme();return}
 const img=$("cover").querySelector("img");if(!img){clearTheme();R.classList.remove("cover-theme");return}
 const go=()=>{try{const r=dominant(img);if(!r)setTheme(355,.15);else setTheme(r.h,Math.max(.35,Math.min(1.1,r.s/.7)));R.classList.add("cover-theme")}catch(e){console.warn("Cover colour failed",e)}};
 img.complete&&img.naturalWidth?go():img.addEventListener("load",go,{once:true})}
tb.onclick=()=>{on=!on;LS.set("detune-cover-theme")(on?"1":"0");sync();note(on?"Colours now follow the album cover.":"Classic blood-red theme.")};
new MutationObserver(sync).observe($("cover"),{childList:true});sync();
/* ---------- slider knob "pop" on release (paired with the .range.pop CSS animation) ---------- */
document.addEventListener("pointerup",e=>{const t=e.target;if(t.classList&&t.classList.contains("range")){t.classList.add("pop");setTimeout(()=>t.classList.remove("pop"),240)}},{capture:true});
/* ---------- lyrics ---------- */
const P=$("lyrics"),B=$("lyrBody"),EB=$("lyrEditBox"),TX=$("lyrText");let lines=[],synced=false,idx=-1,raw="",hold=0;
const key=()=>"detune-lyr:"+$("title").textContent+"|"+$("artist").textContent,hasTrack=()=>$("title").textContent!=="Nothing playing";
function parse(txt){txt=String(txt).replace(/\r/g,"");const out=[],tre=/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;let off=0,any=false;
 for(const ln of txt.split("\n")){const om=ln.match(/^\[offset:\s*(-?\d+)\]/i);if(om){off=+om[1]/1000;continue}if(/^\[[a-z]{2,6}:[^\]]*\]\s*$/i.test(ln))continue;
  const times=[];let m;tre.lastIndex=0;while((m=tre.exec(ln)))times.push(+m[1]*60+ +m[2]+(m[3]?+("0."+m[3]):0));
  const s=ln.replace(tre,"").replace(/<\d+:\d+(?:\.\d+)?>/g,"").trim();if(times.length){any=true;for(const t of times)out.push({t:Math.max(0,t+off),s})}else out.push({t:null,s})}
 return any?{synced:true,lines:out.filter(l=>l.t!==null).sort((x,y)=>x.t-y.t)}:{synced:false,lines:out}}
function render(){B.replaceChildren();idx=-1;
 if(!lines.length){const e=document.createElement("div");e.className="lyrempty";e.innerHTML='<i class="fa-solid fa-microphone-lines"></i><p>No lyrics for this track yet.</p><span>Import a .lrc or .txt file, or use the pen to paste the text.</span>';B.append(e);return}
 const f=document.createDocumentFragment();lines.forEach((l,i)=>{const p=document.createElement("p");p.className="lyr"+(synced?" syn":"")+(l.s?"":" gap");p.textContent=l.s||"♪";if(synced){p.tabIndex=0;p.dataset.i=i}f.append(p)});B.append(f);tick(true)}
function load(){raw=LS.get(key())||"";const r=raw?parse(raw):{synced:false,lines:[]};lines=r.lines;synced=r.synced;$("lyrTitle").textContent=hasTrack()?$("title").textContent:"Lyrics";render()}
function tick(force){if(!synced||!lines.length)return;const t=a.currentTime+.15;let i=-1;for(let k=0;k<lines.length;k++){if(lines[k].t<=t)i=k;else break}
 if(i===idx&&!force)return;B.children[idx]?.classList.remove("on");idx=i;const el=B.children[i];if(!el)return;el.classList.add("on");
 if(!P.hidden&&Date.now()>hold)B.scrollTo({top:el.offsetTop-B.clientHeight/2+el.clientHeight/2,behavior:lite||force?"auto":"smooth"})}
a.addEventListener("timeupdate",()=>tick());a.addEventListener("seeked",()=>tick(true));
for(const ev of["wheel","touchmove"])B.addEventListener(ev,()=>hold=Date.now()+3500,{passive:true});
B.addEventListener("click",e=>{const p=e.target.closest(".syn");if(p){a.currentTime=lines[+p.dataset.i].t;hold=0}});
B.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.classList.contains("syn"))e.target.click()});
let dt=0;new MutationObserver(()=>{clearTimeout(dt);dt=setTimeout(load,60)}).observe($("title"),{childList:true,characterData:true,subtree:true});
new MutationObserver(()=>{clearTimeout(dt);dt=setTimeout(load,60)}).observe($("artist"),{childList:true,characterData:true,subtree:true});
function save(txt){if(!hasTrack())return note("Pick a track first.");if(!txt.trim()){LS.del(key());load();return}if(!LS.set(key())(txt))return note("Browser storage is full. Could not save the lyrics.");load();note(synced?"Synced lyrics saved. Click a line to jump to it.":"Lyrics saved.")}
function open(v){P.hidden=!v;$("lyricsBtn").setAttribute("aria-expanded",v);if(v){load();setTimeout(()=>tick(true),30)}else edit(false)}
function edit(v){EB.hidden=!v;B.hidden=v;if(v){TX.value=raw;TX.focus()}}
$("lyricsBtn").onclick=()=>open(P.hidden);$("lyrClose").onclick=()=>open(false);$("lyrEdit").onclick=()=>{if(!hasTrack())return note("Pick a track first.");edit(EB.hidden)};
$("lyrCancel").onclick=()=>edit(false);$("lyrSave").onclick=()=>{save(TX.value);edit(false)};
$("lyrClear").onclick=()=>{if(raw&&confirm("Remove the lyrics for this track?"))save("")};
$("lyrImport").onclick=()=>hasTrack()?$("lyrFile").click():note("Pick a track first.");
$("lyrFile").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;if(f.size>1048576)return note("That file is too large for lyrics (max 1 MB).");try{save(await f.text())}catch{note("Could not read that file.")}};
/* ---------- LRCLIB fetch (https://lrclib.net/docs) — local-first: nothing leaves the
   browser except title/artist/duration of the ONE track you asked about. Requests go
   with mode:"no-cors" + keepalive:false so the service worker never intercepts them
   (a stale SW previously swallowed these calls and served index.html back as JSON). */
const lrcBusy={on:false};
async function lrcFetchJson(url){
 const ctrl=new AbortController();const to=setTimeout(()=>ctrl.abort(),9000);
 try{
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:ctrl.signal,cache:"no-store"});
  clearTimeout(to);
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.json();
 }finally{clearTimeout(to)}
}
async function fetchLrc(manual){
 if(!window.DetuneCore)return note("Lyrics lookup needs core.js — reload the page.");
 if(!hasTrack())return note("Pick a track first.");
 if(lrcBusy.on)return;
 const title=$("title").textContent.trim(),artist=$("artist").textContent.trim();
 const dur=Math.round(+a.duration||0)||undefined;
 const C_=window.DetuneCore;
 lrcBusy.on=true;$("lyrNet").setAttribute("aria-disabled","true");$("lyrNet").classList.add("busy");
 const finish=()=>{lrcBusy.on=false;$("lyrNet").removeAttribute("aria-disabled");$("lyrNet").classList.remove("busy")};
 try{
  let txt=null;
  const u1=C_.lrcSyncedUrl({artist,title,duration:dur});
  if(u1){try{txt=C_.lrcPick(await lrcFetchJson(u1))}catch(e){if(e.name!=="AbortError")console.warn("LRCLIB /get failed",e)}}
  if(!txt){const u2=C_.lrcSearchUrl({artist,title});
   if(u2){try{txt=C_.lrcPick(await lrcFetchJson(u2))}catch(e){if(e.name!=="AbortError")console.warn("LRCLIB /search failed",e)}}}
  if(txt){save(txt);note("Lyrics fetched from LRCLIB.")}
  else note(manual?"No lyrics found on LRCLIB for this track.":"Nothing found on LRCLIB.");
 }catch(e){
  console.warn("LRCLIB request failed",e);
  note(e&&e.name==="AbortError"?"Lyrics lookup timed out — check your connection.":"Lyrics lookup unavailable offline.");
 }finally{finish()}
}
$("lyrNet").onclick=()=>fetchLrc(true);
let autoFetched=new Set();
const origLoad=load;
load=function(){origLoad();shSync();
 /* one automatic attempt per track per session when the panel is empty */
 if(on&&window.DetuneCore&&!raw&&hasTrack()&&navigator.onLine!==false){
  const k=key();
  if(!autoFetched.has(k)){autoFetched.add(k);setTimeout(()=>{if(!raw&&key()===k)fetchLrc(false)},400)}
 }};
/* ---------- full-screen lyric shower (Apple Music style) ---------- */
const SH=$("lshower"),SHB=$("lshBody"),SHA=$("lshArt"),SHB2=$("lshArtB"),SHC=$("lshCover");let shIdx=-1,shHold=0,shPrev=null,shBgTop=true,shSeeking=false;
/* FIX 1: the shower must be a direct child of <body>. If it's still nested inside #lyrics or
   any transformed/padded container (e.g. an older cached index.html), lift it out now. */
try{if(SH&&SH.parentNode!==document.body)document.body.appendChild(SH)}catch(e){}
const fmtT=n=>Number.isFinite(n)&&n>=0?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,"0")}`:"0:00";
function shDepth(){if(lite||!synced)return;const ch=SHB.children;for(let k=0;k<ch.length;k++){const c=ch[k];c.classList.remove("pn1","pn2","pn3","pnf");if(k===shIdx||c.classList.contains("on"))continue;const d=Math.abs(k-shIdx);c.classList.add(d<=1?"pn1":d===2?"pn2":d===3?"pn3":"pnf")}}
function shRender(){SHB.replaceChildren();shIdx=-1;
 if(!lines.length){const e=document.createElement("div");e.className="lshower-empty";const i0=document.createElement("i");i0.className="fa-solid fa-microphone-lines";const p0=document.createElement("p");p0.textContent="No lyrics for this track yet.";const s0=document.createElement("span");s0.textContent="Import a .lrc file, fetch from LRCLIB, or paste text \u2014 they'll appear here in full screen.";e.append(i0,p0,s0);SHB.append(e);return}
 const f=document.createDocumentFragment();
 lines.forEach((l,i)=>{const p=document.createElement("p");p.className="lyr"+(synced?" syn":"")+(l.s?"":" gap");p.textContent=l.s||"";if(synced)p.dataset.i=i;f.append(p)});
 SHB.append(f);shTick(true)}
function shScrollTo(el){if(!el)return;SHB.scrollTo({top:Math.max(0,el.offsetTop-SHB.clientHeight/3),behavior:(lite||document.documentElement.dataset.shInit==="0")?"auto":"smooth"})}
function shTick(force){if(!synced||!lines.length||SH.hidden)return;const t=a.currentTime+.25;let i=-1;for(let k=0;k<lines.length;k++){if(lines[k].t<=t)i=k;else break}
 if(i===shIdx&&!force)return;SHB.children[shIdx]?.classList.remove("on");shIdx=i;const el=SHB.children[i];if(!el)return;el.classList.add("on");shDepth();
 if(Date.now()>shHold)shScrollTo(el)}
function shArt(v){const img=$( "cover").querySelector("img");if(img&&img.src){(v?SHA:SHB2).src=img.src;(v?SHA:SHB2).classList.add("lsh-vis");(v?SHB2:SHA).classList.remove("lsh-vis");shBgTop=v}else{SHA.classList.remove("lsh-vis");SHB2.classList.remove("lsh-vis")}
 if(SHC){if(img&&img.src){SHC.src=img.src;SHC.style.display=""}else{SHC.removeAttribute("src");SHC.style.display="none"}}}
function shFsOff(){try{if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch{}}
function shOpen(v){if(v&&!hasTrack())return note("Pick a track first.");
 if(v){SH.classList.remove("lsh-out");origLoad();shArt(shBgTop);shBgTop=!shBgTop;
  $("lshTitle").textContent=$("title").textContent;$("lshArtist").textContent=$("artist").textContent;
  /* pause ALL background painting while fullscreen — the shower covers everything, so the
     waveform canvas + embers are pure wasted GPU work behind it (this was the flicker/lag) */
  if(window.DetuneFX)DetuneFX.freeze=true;document.body.classList.add("lyrshow-open");
  shPrev=document.activeElement;SH.hidden=false;document.body.style.overflow="hidden";shRender();shUI();
  /* request real browser fullscreen from inside the click/keydown user-gesture, BEFORE any
     async work — a later call would be blocked by the browser. If it's denied we silently
     keep the fixed-position overlay (it already covers the whole viewport). */
  try{const p=(document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen());if(p&&p.catch)p.catch(()=>{})}catch{}
  document.documentElement.dataset.shInit="0";
  setTimeout(()=>{shTick(true);const el=SHB.children[Math.max(shIdx,0)];if(el)SHB.scrollTop=Math.max(0,el.offsetTop-SHB.clientHeight/3);document.documentElement.dataset.shInit="1";$("lshClose").focus()},60)}
 else{if(SH.hidden)return;shFsOff();
  if(!lite){SH.classList.add("lsh-out");setTimeout(()=>{SH.classList.remove("lsh-out");SH.hidden=true},300)}else SH.hidden=true;
  document.body.style.overflow="";document.body.classList.remove("lyrshow-open");if(shPrev&&document.contains(shPrev))shPrev.focus();
  if(window.DetuneFX){DetuneFX.freeze=false;if(!document.hidden)window.__detuneFxWake&&window.__detuneFxWake()}}
 SH.dispatchEvent(new CustomEvent("detune-shower",{detail:v}))}
function shUI(){if(SH.hidden)return;
 $("lshCur").textContent=fmtT(a.currentTime);$("lshDur").textContent=fmtT(a.duration);
 if(!shSeeking)$("lshSeek").value=String(Math.round((a.duration?Math.min(1,a.currentTime/a.duration):0)*1000));
 const playing=!a.paused&&!a.ended;
 $("lshPlayIcon").innerHTML=playing?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';
 $("lshPlay").setAttribute("aria-label",playing?"Pause":"Play")}
function shSync(){if(!SH.hidden){$("lshTitle").textContent=$("title").textContent;$("lshArtist").textContent=$("artist").textContent;shArt(shBgTop);shBgTop=!shBgTop;shRender();shUI()}}
$("lshClose").onclick=()=>shOpen(false);
$("lshPlay").onclick=()=>{a.paused?a.play().catch(()=>{}):a.pause()};
$("lshPrev").onclick=()=>{$("prev")?.click()};
$("lshNext").onclick=()=>{$("next")?.click()};
{const SK=$("lshSeek");SK.addEventListener("input",()=>{shSeeking=true;if(Number.isFinite(a.duration))a.currentTime=a.duration*(+SK.value/1000)});
 SK.addEventListener("change",()=>{shSeeking=false});SK.addEventListener("pointerup",()=>{shSeeking=false})}
for(const ev of["timeupdate","durationchange"])a.addEventListener(ev,shUI);
a.addEventListener("play",shUI);a.addEventListener("pause",shUI);a.addEventListener("ended",shUI);
new MutationObserver(shSync).observe($("title"),{childList:true,characterData:true,subtree:true});
new MutationObserver(shSync).observe($("artist"),{childList:true,characterData:true,subtree:true});
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&!SH.hidden){/* browser left FS (e.g. F11/Esc at OS level): keep the fixed overlay, no re-request */}});
SH.addEventListener("click",e=>{if(e.target===SH||e.target.classList.contains("lshower-frost")||e.target.classList.contains("lshower-bg"))shOpen(false)});
SHB.addEventListener("click",e=>{const p=e.target.closest(".syn");if(!p)return;a.currentTime=Math.max(0,lines[+p.dataset.i].t-.3);shHold=0;shTick(true)});
for(const ev of["wheel","touchmove"])SHB.addEventListener(ev,()=>shHold=Date.now()+4000,{passive:true});
SHB.addEventListener("keydown",e=>{if(!synced)return;let n=null;
 if(e.key==="ArrowDown")n=Math.min(lines.length-1,shIdx+1);
 else if(e.key==="ArrowUp")n=Math.max(0,shIdx-1);
 else if(e.key==="Home")n=0;else if(e.key==="End")n=lines.length-1;
 else if(e.key==="Enter"&&e.target.classList.contains("syn")){e.target.click();return}
 if(n!=null){e.preventDefault();const el=SHB.children[n];if(el){a.currentTime=Math.max(0,lines[n].t-.3);shHold=Date.now()+4000;shTick(true);if(el)shScrollTo(el)}}});
a.addEventListener("timeupdate",()=>shTick());a.addEventListener("seeked",()=>shTick(true));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!SH.hidden){shOpen(false);e.stopPropagation();return}if(e.key==="Escape"&&!P.hidden){open(false);return}if(e.target.matches("input,textarea,select")||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.toLowerCase()==="l"){if(!SH.hidden){shOpen(false);return}shOpen(SH.hidden)}});
$("shortcuts").querySelector("ul").insertAdjacentHTML("beforeend","<li><b>L</b> — lyrics</li>");
load();
})();
