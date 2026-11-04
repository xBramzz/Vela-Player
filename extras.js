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
/* exposed for the full-screen mesh background: current cover hue/sat (or null on the classic theme) */
window.__detuneTheme=()=>lastHue==null?null:{h:lastHue,s:.7};
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
/* FIX 1: the cover used to be read ONLY from an <img> inside #cover. app.js paints a plain text
   "♫" glyph there whenever a track has no embedded artwork, so querySelector("img") returned null
   and the left column (artwork + everything that depends on shArt) looked dead/empty. Now we take
   the img if present, otherwise fall back to the real object URL of the loaded track's cover blob —
   and if the track genuinely has no artwork we show a themed placeholder instead of nothing. */
const shNoArt="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='38%25' r='75%25'%3E%3Cstop offset='0' stop-color='%236b0912'/%3E%3Cstop offset='1' stop-color='%230a0406'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23g)'/%3E%3Ctext x='200' y='248' font-size='150' text-anchor='middle' fill='%23ff3b47' fill-opacity='.5' font-family='Georgia,serif'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";
function shCoverSrc(){try{const c=$("cover");const im=c&&c.querySelector("img");if(im&&im.src)return im.src;const t=(window.Detune&&Detune.current&&Detune.current())||(window.C_&&C_.cur&&C_.cur())||null;if(t&&t.coverUrl)return t.coverUrl;if(t&&t.cover&&!t.coverUrl)t.coverUrl=safeURL(t.cover);if(t&&t.coverUrl)return t.coverUrl}catch(e){}return shNoArt}
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
/* ---------- Apple-Music-style MOVING MESH BACKGROUND (full-screen lyric shower) ----------
   5 dominant colours sampled from the current cover → huge blurred blobs drifting on their own
   lissajous paths, pulsing with the LOW band of the track. Only transform/opacity are animated;
   the rAF loop runs ONLY while the overlay is open and never touches layout, so it can't affect
   the left column or the lyrics. Respects prefers-reduced-motion (static blobs, no pulse). */
const reduceMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
const SHBG=SH.querySelector(".lshower-bg");let mesh=null,meshRaf=0,meshPrev=null,meshB=0,meshT=0;
/* HSL -> "r g b" triple for CSS rgb(var(--c)/alpha) */
const hslRGB=(h,s,l)=>{h=((h%360)+360)%360;s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));
 const f=n=>{const k=(n+h/30)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))))};return `${f(0)} ${f(8)} ${f(4)}`};
/* sample the cover on a tiny 32x32 canvas and pick up to 5 REAL dominant colours (bucketed
   averaging over hue AND lightness — grayscale covers keep their grays, no hue shifting). */
function meshColors(img){try{if(!img||!img.complete||!img.naturalWidth)return null;const c=document.createElement("canvas");c.width=c.height=32;
 const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,32,32);const d=x.getImageData(0,0,32,32).data; /* SecurityError if tainted → neutral fallback */
 const px=[];for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,df=mx-mn;
  let h=0;if(df>.04){h=mx===r?((g-b)/df)%6:mx===g?(b-r)/df+2:(r-g)/df+4;h=(h*60+360)%360}else l<.04||l>.96?h=-1:h=-1; /* achromatic → hue bucket -1 (grays) */
  px.push({r,g,b,h,s:df,l})}
 if(px.length<6)return null;const bins={};for(const p of px){const k=p.s<=.04?"g":String((p.h/30)|0)+(p.l<.34?"L":p.l<.67?"M":"H");const e=bins[k]||(bins[k]={r:0,g:0,b:0,n:0});e.r+=p.r;e.g+=p.g;e.b+=p.b;e.n++}
 const cand=Object.values(bins).filter(e=>e.n>=2).map(e=>{const r=e.r/e.n,g=e.g/e.n,b=e.b/e.n,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,df=mx-mn;let s=df/(1-Math.abs(2*l-1)||1);s=Math.min(1.2,s*1.2);return{r,g,b,l,s,n:e.n}}).sort((a,b)=>b.n-a.n);
 const out=[];for(const c0 of cand){if(out.length>=5)break;if(out.every(o=>Math.hypot(c0.r-o.r,c0.g-o.g,c0.b-o.b)>.17))out.push(c0)}
 while(out.length<4&&cand.length&&out.length<cand.length)out.push(cand[out.length]);
 return out.map(p=>{let{r,g,b}=p;if(p.l>.7){const k=.82;p.r=r*k;p.g=g*k;p.b=b*k;r=p.r;g=p.g;b=p.b}return`${Math.round(r*255)} ${Math.round(g*255)} ${Math.round(b*255)}`}).length?out.map(p=>[p.r,p.g,p.b]):null}catch(e){return null}}
/* ONLY fallback when the canvas is CORS-tainted / unreadable: neutral dark grays (never theme red) */
function meshFallback(){return["0.10 0.10 0.11","0.16 0.16 0.18","0.07 0.07 0.08","0.22 0.22 0.24","0.12 0.12 0.13"].map(s=>{const [r,g,b]=s.split(" ").map(Number);return`${Math.round(r*255)} ${Math.round(g*255)} ${Math.round(b*255)}`})}
const MPOS=[[50,42],[22,24],[80,28],[26,76],[78,72]],MSZ=["64vmax","58vmax","52vmax","66vmax","56vmax"], /* 50–70vmax — soft, never a distinct disc */
 MF=[{a:.30,b:.22,c:.16,d:.26},{a:.24,b:.34,c:.22,d:.14},{a:.34,b:.18,c:.12,d:.28},{a:.2,b:.28,c:.32,d:.18},{a:.28,b:.22,c:.26,d:.32}];
/* the cover <img> used for sampling: prefer the shower's own copy (already loaded & same-origin),
   then #cover img, then the main-app object URL. Reading pixels from an object URL / same-origin
   blob is always safe; only a genuinely cross-origin image taints the canvas (→ neutral fallback). */
function meshSrc(){const c=(SHC&&(SHC.currentSrc||SHC.src))||"";if(c)return c;const im=$("cover")&&$("cover").querySelector("img");return(im&&im.src)||shCoverSrc()}
const meshSpd=b=>.55+(+b.dataset.t||0)*.05; /* per-blob base speed (dataset.t is a random 0..20 offset) */
function meshBuild(){if(!SHBG)return null;const m=document.createElement("div");m.className="lsh-mesh";m.setAttribute("aria-hidden","true");
 const sp=document.createElement("div");sp.className="lsh-spin";m.append(sp); /* slow rotating carousel (~60s/turn, bass speeds it up in meshStart) */
 /* FIX (colours didn't match the cover): sample the SHOWER'S OWN cover copy first — it is the exact
    artwork being displayed and (unlike #cover img) is guaranteed to be loaded here. */
 let cols=meshColors(SHC)||meshColors($("cover").querySelector("img"));
 if(!cols){cols=meshFallback();meshPreload(meshSrc())} /* not decoded yet / tainted → grays now, real rebuild when ready */
 cols.slice(0,5).forEach((rgb,i)=>{const b=document.createElement("div");b.className="lsh-blob";
  b.style.setProperty("--c",rgb);b.style.setProperty("--x",MPOS[i][0]+"%");b.style.setProperty("--y",MPOS[i][1]+"%");
  b.style.setProperty("--sz",MSZ[i]);b.dataset.i=i;b.dataset.t=(Math.random()*20).toFixed(2);b.dataset.ph=(Math.random()*6.283).toFixed(2);sp.append(b)});
 return m}
/* FIX (colours didn't match the cover): sample only AFTER the image finished decoding — reading a
   half-loaded img gives smeared/wrong pixels. Decode once per src, then rebuild the mesh with the
   REAL dominant colours. Skip data:/blob: URLs — those are already readable directly from <img>. */
let meshPending=null,meshTried="";
function meshPreload(src){if(!src||src===meshTried||/^(data|blob):/.test(src))return;meshTried=src;meshPending=src;
 const probe=new Image();probe.decoding="async";
 probe.onload=()=>{if(meshPending!==src)return;meshPending=null;if(!SH.hidden&&meshColors(probe))meshSet(true)};
 probe.onerror=()=>{if(meshPending===src)meshPending=null};probe.src=src}
function meshSet(v){const n=meshBuild();if(!n)return;const o=mesh;mesh=n;
 if(reduceMotion||lite){if(o)o.remove()}else{n.classList.add("lsh-mesh-in");if(o){o.classList.remove("lsh-mesh-in");o.classList.add("lsh-mesh-out");setTimeout(()=>o.remove(),1100)}} /* ~1s crossfade old→new colours */
 SHBG.prepend(n);
 if(reduceMotion||lite){meshStop();return}meshStart()}
function meshLow(){/* average of the lowest analyser bins ≈ 20–120 Hz — reuses fx.js's existing
 analysers (DetuneFX.analyser / .analyserB during a crossfade); creates nothing, changes no sound */
 const FX=window.DetuneFX;if(!FX)return 0;const an=(window.__detuneXfade&&FX.analyserB)?FX.analyserB:FX.analyser;if(!an)return 0;
 const n=an.frequencyBinCount,buf=meshLow.b&&(meshLow.b.length===n)?meshLow.b:(meshLow.b=new Uint8Array(n));an.getByteFrequencyData(buf);
 const hz=an.context.sampleRate/an.fftSize;let s=0,c=0;for(let i=Math.max(1,(20/hz)|0);i<=Math.min(n-1,(120/hz)|0);i++){s+=buf[i];c++}
 return c?s/c/255:0}
function meshStop(){if(meshRaf){cancelAnimationFrame(meshRaf);meshRaf=0}meshPrev=null;meshB=0;if(mesh)mesh.style.removeProperty("--lshBass")}
function meshStart(){if(meshRaf||!mesh||reduceMotion||lite)return;let last=performance.now(),acc=0,spin=mesh.spin||0;
 const step=t=>{meshRaf=requestAnimationFrame(step);let dt=(t-last)/1000;last=t;if(!(dt>0)||dt>.25)dt=.016;
  if(document.hidden)return;acc+=dt;if(acc<.033)return;acc=0; /* cap at ~30 updates/s — plenty for slow drift */
  const low=meshLow(),tgt=Math.min(1,Math.max(0,(low-.18)/.5));meshB=tgt>meshB?meshB+(tgt-meshB)*.55:meshB+(tgt-meshB)*.07; /* fast attack, slow release */
  mesh.style.setProperty("--lshBass",meshB.toFixed(3));meshT+=dt*(1+meshB*.7); /* bass speeds the whole drift up (slow breathing, never flashing) */
  spin+=dt*(6+meshB*4);/* deg/s: one turn per 60s baseline (6°/s), up to ~1.67x faster on the kick */mesh.spin=spin;
  const sp0=mesh.querySelector(".lsh-spin");if(sp0)sp0.style.setProperty("--lshSpin",(spin%360).toFixed(2)+"deg");
  const tt=meshT;for(const b of (sp0||mesh).children){const i=+b.dataset.i||0,f=MF[i]||MF[0],ph=+b.dataset.ph,sp=meshSpd(b),x=tt*sp;
   b.style.setProperty("--tx",(Math.sin(x*f.a+ph)*9).toFixed(2)+"%");b.style.setProperty("--ty",(Math.cos(x*f.b+ph*1.7)*8).toFixed(2)+"%");
   const sc=1+meshB*.2;b.style.setProperty("--sx",sc.toFixed(3));b.style.setProperty("--sy",(sc*(1+.05*Math.sin(x*f.c+ph))).toFixed(3));
   b.style.opacity=(.62+meshB*.22).toFixed(3)}};
 meshRaf=requestAnimationFrame(step)}
function shArt(v){const img=$("cover").querySelector("img"),src=(img&&img.src)||shCoverSrc();
 const top=v?SHA:SHB2,bot=v?SHB2:SHA; /* two stacked copies of the blurred cover CROSSFADE (~1s CSS transition) on track change */
 if(top.getAttribute("src")!==src)top.src=src;top.classList.add("lsh-vis");top.classList.remove("lsh-gone");
 bot.classList.remove("lsh-vis");bot.classList.add("lsh-gone");shBgTop=v;
 if(SHC){if(src){SHC.src=src;SHC.style.display=""}else{SHC.removeAttribute("src");SHC.style.display="none"}}
 /* moving mesh background: rebuild (with ~1s crossfade) whenever the cover changes */
 meshSet(!!src)}
function shFsOff(){try{if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch{}}
function shOpen(v){if(v&&!hasTrack())return note("Pick a track first.");
 if(v){SH.classList.remove("lsh-out");document.body.classList.remove("lsh-out");origLoad();shArt(shBgTop);shBgTop=!shBgTop;
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
  /* close: fade out ONLY the root overlay element with one opacity transition — no child of the
     overlay gets its style touched (the old code put .lsh-out on SH itself and also relied on a
     keyframe animation; both could leave the left column stuck at opacity 0). */
  if(!lite){R.classList.add("lsh-out");setTimeout(()=>{R.classList.remove("lsh-out");SH.hidden=true;meshStop()},320)}else{SH.hidden=true;meshStop()}
  document.body.style.overflow="";document.body.classList.remove("lyrshow-open");if(shPrev&&document.contains(shPrev))shPrev.focus();
  if(window.DetuneFX){DetuneFX.freeze=false;if(!document.hidden)window.__detuneFxWake&&window.__detuneFxWake()}}
 SH.dispatchEvent(new CustomEvent("detune-shower",{detail:v}))}
function shUI(){if(SH.hidden)return;
 $("lshCur").textContent=fmtT(a.currentTime);
 /* Apple-style: elapsed left, REMAINING as −m:ss right (falls back to total without metadata) */
 $("lshDur").textContent=Number.isFinite(a.duration)?"-"+fmtT(Math.max(0,a.duration-a.currentTime)):fmtT(a.duration);
 if(!shSeeking)$("lshSeek").value=String(Math.round((a.duration?Math.min(1,a.currentTime/a.duration):0)*1000));
 const playing=!a.paused&&!a.ended;
 $("lshPlayIcon").innerHTML=playing?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';
 $("lshPlay").setAttribute("aria-label",playing?"Pause":"Play")}
/* FIX 1b (left column invisible): shSync used to run whenever the main-app #title/#artist text
   changed — even while the shower was ALREADY open. Re-applying SH.hidden=false / re-rendering on
   top of an open overlay restarted its entrance animation from opacity:0 (the "flash then gone"
   symptom). Now a track change while open only updates CONTENT (cover src, title, artist, time,
   play/pause icon) — the left column itself is static markup in index.html and is never removed. */
function shSync(){if(!SH.hidden){$("lshTitle").textContent=$("title").textContent;$("lshArtist").textContent=$("artist").textContent;shArt(shBgTop);shBgTop=!shBgTop;shRender();shUI()}}
$("lshClose").onclick=()=>shOpen(false);
$("lshPlay").onclick=()=>{a.paused?a.play().catch(()=>{}):a.pause()};
$("lshPrev").onclick=()=>{$("prev")?.click()};
$("lshNext").onclick=()=>{$("next")?.click()};
{const SK=$("lshSeek");SK.addEventListener("input",()=>{shSeeking=true;SK.classList.add("lsh-drag");if(Number.isFinite(a.duration))a.currentTime=a.duration*(+SK.value/1000)});
 SK.addEventListener("change",()=>{shSeeking=false;SK.classList.remove("lsh-drag")});SK.addEventListener("pointerup",()=>{shSeeking=false;SK.classList.remove("lsh-drag")});
 /* keep --p (fill %) fresh for the Apple-style track gradient — fx.js's publisher is frozen while
    the shower is open */
 const shP=()=>{const v=(SK.value-SK.min)/(SK.max-SK.min)*100;SK.style.setProperty("--p",v.toFixed(2)+"%")};
 new MutationObserver(()=>{if(!SH.hidden)shP()}).observe(SK,{attributes:true,attributeFilter:["value"]});shP()}
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
