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
 const cov=$("cover"),img=cov&&cov.querySelector("img");if(!img){clearTheme();R.classList.remove("cover-theme");return}
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
/* FIX (ReferenceError: shMeta is not defined): the old big title/artist meta block that sat ABOVE
   the progress bar was removed when the left column was rebuilt. Its updater function (shMeta) and
   its elements went with it — but two call sites still called shMeta(), so pressing L threw before
   the overlay could open. The NEW elements that show title/artist are #lshTitle / #lshArtist (below
   the seek bar); shMeta() below now points at THOSE. The old block is intentionally NOT re-added. */
const SHT=$("lshTitle"),SHAR=$("lshArtist");
/* artist strings use "/" as the separator ("YNW Melly/YNW BSlime/Jit4 Stan") — display it as ", " */
const shArtist=t=>String(t==null?"":t).replace(/\//g,", ").trim();
/* FIX 1: the shower must be a direct child of <body>. If it's still nested inside #lyrics or
   any transformed/padded container (e.g. an older cached index.html), lift it out now. */
try{if(SH&&SH.parentNode!==document.body)document.body.appendChild(SH)}catch(e){}
/* same for the CLOSE button — it must be a DIRECT child of the root overlay so no ancestor with
   transform/filter/overflow can clip it. Older cached markup left it inside other wrappers. */
try{const CL=$("lshClose");if(CL&&SH&&CL.parentNode!==SH)SH.prepend(CL)}catch(e){}
const fmtT=n=>Number.isFinite(n)&&n>=0?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,"0")}`:"0:00";
/* FIX 1: the cover used to be read ONLY from an <img> inside #cover. app.js paints a plain text
   "♫" glyph there whenever a track has no embedded artwork, so querySelector("img") returned null
   and the left column (artwork + everything that depends on shArt) looked dead/empty. Now we take
   the img if present, otherwise fall back to the real object URL of the loaded track's cover blob —
   and if the track genuinely has no artwork we show a themed placeholder instead of nothing. */
const shNoArt="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='38%25' r='75%25'%3E%3Cstop offset='0' stop-color='%236b0912'/%3E%3Cstop offset='1' stop-color='%230a0406'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23g)'/%3E%3Ctext x='200' y='248' font-size='150' text-anchor='middle' fill='%23ff3b47' fill-opacity='.5' font-family='Georgia,serif'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";
/* cover source for the overlay. app.js does NOT expose window.Detune and safeURL is private to
   app.js, so the old Detune.current()/safeURL path was dead code that could itself throw a
   ReferenceError (caught, but it meant no artwork). Now: #cover img → the live <audio> object URL
   (same-origin blob, always readable) → themed placeholder. */
function shCoverSrc(){try{const c=$("cover");const im=c&&c.querySelector("img");if(im&&im.src)return im.src;if(a&&a.src&&/^blob:/.test(a.src))return a.src}catch(e){}return shNoArt}
function shDepth(){if(lite||!synced)return;const ch=SHB.children;for(let k=0;k<ch.length;k++){const c=ch[k];c.classList.remove("pn1","pn2","pn3","pnf");if(k===shIdx||c.classList.contains("on"))continue;const d=Math.abs(k-shIdx);c.classList.add(d<=1?"pn1":d===2?"pn2":d===3?"pn3":"pnf")}}
function shRender(){SHB.replaceChildren();shIdx=-1;
 if(!lines.length){const e=document.createElement("div");e.className="lshower-empty";const i0=document.createElement("i");i0.className="fa-solid fa-microphone-lines";const p0=document.createElement("p");p0.textContent="No lyrics for this track yet.";const s0=document.createElement("span");s0.textContent="Import a .lrc file, fetch from LRCLIB, or paste text \u2014 they'll appear here in full screen.";e.append(i0,p0,s0);SHB.append(e);return}
 const f=document.createDocumentFragment();
 lines.forEach((l,i)=>{const p=document.createElement("p");p.className="lyr"+(synced?" syn":"")+(l.s?"":" gap");p.textContent=l.s||"";if(synced)p.dataset.i=i;f.append(p)});
 SHB.append(f);shTick(true)}
function shScrollTo(el){if(!el)return;SHB.scrollTo({top:Math.max(0,el.offsetTop-SHB.clientHeight/3),behavior:(lite||document.documentElement.dataset.shInit==="0")?"auto":"smooth"})}
function shTick(force){if(!synced||!lines.length||SH.hidden)return;const t=a.currentTime+.25;let i=-1;for(let k=0;k<lines.length;k++){if(lines[k].t<=t)i=k;else break}
 if(i===shIdx&&!force)return;if(!SHB.children[shIdx]?.classList.contains("on"))shProgress(); /* lyric-jump / arrow-key seeks: fill must follow instantly */
 SHB.children[shIdx]?.classList.remove("on");shIdx=i;const el=SHB.children[i];if(el)el.classList.add("on");shDepth();
 if(Date.now()>shHold)shScrollTo(el)}
/* ---------- Apple-Music-style MOVING MESH BACKGROUND (full-screen lyric shower) ----------
   5 dominant colours sampled from the current cover → huge blurred blobs drifting on their own
   lissajous paths, pulsing with the LOW band of the track. Only transform/opacity are animated;
   the rAF loop runs ONLY while the overlay is open and never touches layout, so it can't affect
   the left column or the lyrics. Respects prefers-reduced-motion (static blobs, no pulse). */
const reduceMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
const SHBG=SH&&SH.querySelector(".lshower-bg");let mesh=null,meshRaf=0,meshPrev=null,meshB=0,meshT=0;
/* ================= OWN BASS ANALYSER (priority 1) =================
   WHY THE OLD VERSION NEVER PULSED — three independent killers, all found in the code:
   1. DetuneFX.freeze is set to true for the WHOLE time the shower is open (shOpen), and fx.js's
      tick() returns at the top while frozen — so fx.js never published --bass/--mid/--treb/--beat
      while the overlay was up. The old meshLow() read FX.analyser NODES directly, which still
      worked, but any style that depended on the published --bass variable was dead by design.
   2. The pulse was applied to .lsh-spin — the very element whose rotation ANGLE is written by JS.
      In reduced-motion/lite mode CSS instead runs `animation:lshSpin 60s linear infinite` ON THAT
      SAME ELEMENT, and a CSS animation on transform overrides any inline scale → invisible pulse.
   3. On deck A the analyser hangs off `compressor` (BEFORE master volume/mute); deck B's tap
      (captureStream) is silent when paused, so during a crossfade its bins decayed to ~0.
   FIX: the overlay now owns its own analyser and its own rAF loop (below). It REUSES the app's
   existing AudioContext + graph (window.DetuneApp.audioGraph, published by app.js) and attaches to
   the FINAL master output (master → ctx.destination, i.e. AFTER EQ/compressor/reverb/volume), plus
   deck B's real media-stream tap while a crossfade runs. NO createMediaElementSource call happens
   here — that API can only ever be called once per element (app.js already owns #audio) and it also
   re-routes the element into the graph, which would have silenced the speakers. An AnalyserNode is a
   pure probe: connecting master→analyser adds no audible path (analysers don't auto-connect to the
   destination), so the audio chain to the speakers is untouched. */
/* ROOT CAUSE FOUND (why NOTHING ever reacted): app.js publishes its audio graph only AFTER the
   whole setupAudio() chain finishes — including `await audioWorklet.addModule(...)`, which can take
   seconds or fail on a flaky/offline load. Every earlier version of this file read
   DetuneApp.audioGraph at SCRIPT-LOAD time and cached the result in a const — that was always
   undefined — and shWire()'s first line bailed out (`if(!G... )return false`) whenever the graph
   hadn't been published yet. Result: our own bass analyser NEVER existed, shOut stayed 0 forever,
   coverBassStep wrote 0.000 every frame, AudioMotion never built (same early return), and the
   blurred cover sat dead at scale(1.6)/brightness(.7). The rAF loop ran perfectly the whole time —
   it just had no data source. FIX: never cache the graph; re-read window.DetuneApp.audioGraph live
   EVERY call (the retry block below picks it up within ~1.5 s of app.js publishing it, even if you
   opened the overlay before playback started). */
let shCtx=null,shAnalyser=null,shBuf=null,shSrcList=[],shTap=null,shWired=false,shWiredAt=0,shRun=false,shRaf=0,shResumeBound=false;
function shWire(){
 const G=window.DetuneApp&&DetuneApp.audioGraph;const AC=window.AudioContext||window.webkitAudioContext;
 if(!G||!G.ctx||!AC||!G.master)return false; /* read LIVE — never a stale load-time snapshot */
 try{
  if(shCtx!==G.ctx){ /* context replaced (teardown / retry): rebuild our probe from scratch */
   for(const n of shSrcList){try{n.disconnect()}catch{}}shSrcList=[];shAnalyser=null;shTap=null;shXtap=null;shXsrc=null}
  shCtx=G.ctx;
  if(!shAnalyser){
   /* OWN analyser on the FINAL master GainNode (post volume/mute/pitch/fx). We deliberately do NOT
      reuse app.js's `analyser`: it taps `compressor` PRE-master (mute/volume ignored) and fx.js is
      frozen while the shower is open, so nothing else reads it here. AnalyserNode is a pure probe:
      connecting master→analyser adds no audible path, so the speakers are untouched. */
   shAnalyser=shCtx.createAnalyser();shAnalyser.fftSize=2048;shAnalyser.smoothingTimeConstant=.6;
   shTap=shCtx.createGain();shTap.gain.value=1; /* stable handle so we can always disconnect cleanly */
   try{G.master.connect(shTap);shTap.connect(shAnalyser)}catch{}
   try{if(G.wet&&G.wet!==G.master){G.wet.connect(shAnalyser)}}catch{}}
  if(!shWired||performance.now()-shWiredAt>1500){ /* deck B is NOT bound via createMediaElementSource
     (see app.js bindDeckB) — captureStream() gives us its real, audible signal during a crossfade.
     Re-acquired after ~1.5 s so a track change that restarts deck B's stream doesn't leave a dead tap. */
   shWired=true;shWiredAt=performance.now();
   try{for(const n of shSrcList){try{n.disconnect()}catch{}}shSrcList=[shAnalyser]}catch{}
   const el=[$("audio"),$("audioB")];
   for(const e0 of el){if(!e0||typeof e0.captureStream!=="function")continue;
    try{const src=shCtx.createMediaStreamSource(e0.captureStream());src.connect(shAnalyser);shSrcList.push(src)}catch{}}
   try{const b=G.bAnalyser;if(b&&b!==shAnalyser)b.connect(shAnalyser)}catch{}}
  return !!shAnalyser}catch(e){return false}}
/* suspended context (autoplay policy) → resume on ANY user interaction; playback itself also resumes it */
if(!shResumeBound){shResumeBound=true;
 for(const ev of["pointerdown","keydown","touchstart","click"])document.addEventListener(ev,()=>{try{const G=window.DetuneApp&&DetuneApp.audioGraph;const c=G&&G.ctx;if(c&&c.state==="suspended")c.resume().catch(()=>{})}catch{}},{passive:true})}
/* one raw low-band reading (≈20–120 Hz) averaged over every source currently feeding our analyser */
function shRawLow(){
 if(!shAnalyser)return -1;
 const n=shAnalyser.frequencyBinCount;
 if(!shBuf||shBuf.length!==n)shBuf=new Uint8Array(n);
 const hz=shAnalyser.context.sampleRate/shAnalyser.fftSize;
 let lo=Math.max(1,(20/hz)|0),hi=Math.min(n-1,Math.ceil(120/hz));if(hi<=lo)hi=lo+1;
 let best=-1,got=false;
 for(const src of shSrcList){if(!src)continue; /* [shAnalyser, ...stream sources] */
  try{src.getByteFrequencyData(shBuf)}catch{continue}
  let s=0,c=0;for(let i=lo;i<=hi;i++){s+=shBuf[i];c++}
  const v=c?s/c/255:0;if(v>best)best=v;got=true}
 return got?best:-1}
/* KICK FOLLOWER (not loudness): keep a running average of the bass band over ~1 s and pulse on how
   much the CURRENT level sits ABOVE that baseline. A sustained 808 raises the baseline with it (no
   permanent glow); a kick transient spikes against it. Smoothing: attack ≈50 ms, release ≈350 ms
   (one-pole time constants evaluated per frame). */
let shAvg=0,shOut=0,shLast=0;
function shBassStep(t){
 if(!shRun)return;shRaf=requestAnimationFrame(shBassStep);
 let dt=(t-shLast)/1000;shLast=t;if(!(dt>0)||dt>.25)dt=1/60;
 if(document.hidden){return}
 if(performance.now()-shWiredAt>1500)shWire();
 amaBuild(); /* re-attempt EVERY frame while open — the graph may be published late (see shWire note);
   no-op once the instance exists, so it costs nothing after the first success */
 const x=shRawLow();
 if(x<0){shAvg+=(0-shAvg)*(1-Math.exp(-dt/1));shOut+=(0-shOut)*(1-Math.exp(-dt/.35))}
 else{
  shAvg+=(x-shAvg)*(1-Math.exp(-dt/1));                      /* ~1 s running average = "loudness floor" */
  const boost=1+.9*Math.min(1,shAvg*4);                      /* quiet tracks get more gain, loud ones less */
  const dyn=Math.min(1,Math.max(0,(x-shAvg*boost)/(.10*boost))); /* the KICK component only */
  const k=Math.min(1,Math.max(0,dyn*.92+x*.08));
  shOut+=(k-shOut)*(k>shOut?(1-Math.exp(-dt/.05)):(1-Math.exp(-dt/.35)))} /* fast attack / slow release */
 if(mesh){mesh.style.setProperty("--bg-bass",shOut.toFixed(3));/* one variable, inherited by .bg-pulse/.lsh-mesh/.lsh-spin */
  const sp0=mesh.querySelector(".lsh-spin");if(sp0)sp0.style.setProperty("--bg-bass",shOut.toFixed(3))} /* ALSO set directly on .lsh-spin: reduced-motion/lite CSS pins transform:none on its ANCESTORS (.lsh-mesh-out crossfade), which would otherwise clip the subtree and freeze an inherited var */
 amaGlowStep(t);coverBassStep(t)} /* glow + blurred-cover bass reaction */
function shBassStart(){amaGlowMake();if(amaGlow&&SHBG&&amaGlow.parentNode===SHBG)SHBG.append(amaGlow); /* glow always LAST inside .lshower-bg → above mesh, below content */
 if(shRun)return;shRun=true;shWire();amaBuild();shLast=performance.now();shRaf=requestAnimationFrame(shBassStep);
 /* DIAGNOSTIC (temporary — remove after verifying): proves the rAF loop is actually running.
    Type in console: DetuneAMA.loop()  → must print "alive @ <timestamp>" every second while open.
    If it prints "DEAD", nothing below can possibly move and we look upstream instead. */
 try{window.DetuneAMA&&Object.assign(DetuneAMA,{loop:()=>{console.log(shRun?"alive @ "+Math.round(performance.now()):"DEAD");clearInterval(DetuneAMA._lp);DetuneAMA._lp=setInterval(()=>console.log("bass-loop alive @ "+Math.round(performance.now())+" · wired:"+!!shAnalyser+" · kick:"+shOut.toFixed(3)+" · ama:"+(!!ama&&ama.isOn)),1000)}})}catch(e){}}
function shBassStop(){shRun=false;if(shRaf){cancelAnimationFrame(shRaf);shRaf=0}
 if(mesh){mesh.style.removeProperty("--bg-bass");const sp0=mesh.querySelector(".lsh-spin");if(sp0)sp0.style.removeProperty("--bg-bass")}
 /* reset BOTH blurred-cover <img>s (#lshArt/#lshArtB) so a stale inline --bg-bass can't linger */
 for(const im of[SHA,SHB2]){if(im)im.style.removeProperty("--bg-bass")}
 amaStop()}
/* ================= BLURRED COVER BASS REACTION (the user asked for THIS one) =================
   The background of the lyrics overlay IS these two <img>s (.lshower-bg img → #lshArt/#lshArtB).
   They consume ONE variable — --bg-bass (extras.css): brightness .7→.86, saturate 1.35→1.6,
   scale 1.6→1.645 on every kick. This writes it DIRECTLY onto the visible image element itself
   (not just the mesh wrapper), so nothing in between (crossfade wrappers, reduced-motion rules
   pinning ancestor transforms, z-tier reshuffles) can ever intercept or freeze it. Source value:
   AudioMotion's LOW band when the analyzer is live, our own kick follower (shOut) otherwise. */
let covLo=0;
function coverBassStep(t){
 const vis=(v)=>{if(!v)return;let b=covLo;if(v===SHA&&SHB2&&SHB2.classList.contains("lsh-vis"))b=Math.max(covLo,shOut);v.style.setProperty("--bg-bass",b.toFixed(3))};
 let lo=-1;
 try{if(ama&&ama.isOn&&!ama.isDestroyed)lo=ama.getEnergy("bass")}catch{lo=-1}
 if(!(lo>=0)){covLo+=(Math.min(1,shOut*1.15)-covLo)*(shOut>covLo?.5:.12);vis(SHA);vis(SHB2);return}
 const dt=Math.min(.1,Math.max(0,(t-amaLast.t)/1000)); /* amaLast.t already updated by amaGlowStep this frame */
 covLo+=(Math.min(1,lo)-covLo)*(lo>covLo?(1-Math.exp(-dt/.05)):(1-Math.exp(-dt/.3)));
 vis(SHA);vis(SHB2)}
/* ================= AUDIOMOTION BASS GLOW (optional, extras-only) =================
   audiomotion-analyzer renders NO numbers itself — the readout at the bottom was our own
   debug div ("bass 0.42 · avg 0.11"), now removed (see shBassStep / the old lsh-bassdbg IIFE).
   DATA-ONLY instance: useCanvas:false → nothing is drawn and no canvas is appended to the page;
   getEnergy() still works because the analyzer's rAF loop updates the FFT even when the draw
   body skips all painting. connectSpeakers:false → AMA never connects its output to
   ctx.destination, so app.js's audio path is untouched. source:G.master taps the FINAL master
   GainNode (post pitch-worklet/fx chain); createMediaElementSource is never called again.
   Those values drive .lsh-bassglow behind the mesh — the visible background pulses with the bass. */
let ama=null,amaGlow=null,amaLast={t:0,lo:0,mid:0,hi:0};
/* The glow div does NOT depend on audiomotion-analyzer loading — create it on its own so the
   background reacts even if the vendored script is stale/missing (e.g. old service-worker cache). */
function amaGlowMake(){if(amaGlow||!SHBG)return null;
 const g=document.createElement("div");g.className="lsh-bassglow";g.setAttribute("aria-hidden","true");
 SHBG.append(g);amaGlow=g;
 const bl=mesh?mesh.querySelectorAll(".lsh-blob"):null;
 for(let i=0;bl&&i<3&&bl[i];i++){const c=bl[i].style.getPropertyValue("--c").trim();if(c)g.style.setProperty("--bgc"+(i+1),c)}
 return g}
function amaOk(){return typeof window.AudioMotionAnalyzer==="function"}
function amaBuild(){if(!SHBG)return;amaGlowMake(); /* glow first, analyzer second — never blocked by it */
 if(!amaOk())return;const G=window.DetuneApp&&DetuneApp.audioGraph;if(!G||!G.ctx||!G.master)return;
 try{
  if(ama&&(ama.isDestroyed||ama.audioCtx!==G.ctx)){amaKill()} /* torn down / AudioContext replaced → rebuild */
  if(!ama){
   /* DATA-ONLY instance: useCanvas:false → no bars/LEDs are ever painted (AMA still creates an
      off-DOM canvas internally and runs its rAF loop — that's what updates the FFT, so
      getEnergy() keeps working). connectSpeakers:false → AMA never connects its output to
      ctx.destination; audio stays on app.js's own path.
      source:G.master taps the FINAL master GainNode (post pitch-worklet/fx chain) as a probe —
      createMediaElementSource is never called again (app.js already owns <audio id="audio">). */
   /* DATA-ONLY instance. VERIFIED against the vendored 4.5.4 build:
      - constructor(container, options): passing G.ctx as arg 1 with a NON-empty options object is
        IGNORED (line ~234: options are only hoisted when the first arg is the sole argument) — so
        the context must ALSO be in options as audioCtx, otherwise AMA news up its own AudioContext.
      - source:<AudioNode> → connectInput() does node.connect(this._input) — a pure probe; NO
        createMediaElementSource for AudioNodes (only for HTMLMediaElements), so app.js's graph is
        never re-routed and nothing throws "already bound".
      - connectSpeakers:false → skips connectOutput() ONLY at construction (line ~305). toggleAnalyzer
        NEVER touches connections — it only schedules _draw rAF — so the analyser chain stays alive
        while silent. We still pass a ZERO-GAIN sink below as belt-and-braces: even if any code path
        did connectAMA's output to ctx.destination, gain 0 = no echo / no double-audio.
      - useCanvas:false → nothing painted; getFloatFrequencyData + updateEnergy run per frame inside
        _draw(), so getEnergy("bass") returns live data. */
   ama=new AudioMotionAnalyzer({
    audioCtx:G.ctx,
    source:G.master,
    connectSpeakers:false,
    useCanvas:false,
    fftSize:8192,
    minFreq:20,maxFreq:16000,
    smoothing:.7
   });
   try{const sink=G.ctx.createGain();sink.gain.value=0;ama.connectOutput(sink);sink.connect(G.ctx.destination)}catch{}
   console.info("[extras] AudioMotion analyzer attached to master");
  }
  if(amaGlow&&SHBG&&amaGlow.parentNode!==SHBG)SHBG.append(amaGlow); /* keep it LAST inside .lshower-bg → paints over mesh */
  if(!ama.isOn)ama.toggleAnalyzer(true);
 }catch(e){console.warn("[extras] AudioMotion build failed:",e&&e.message||e);amaKill()}} /* stop retrying a broken instance; kick-follower fallback keeps the cover reacting */
function amaStop(){if(ama&&!ama.isDestroyed){try{ama.toggleAnalyzer(false)}catch{}}} /* keep instance for cheap reopen */
function amaKill(){amaStop();if(ama&&!ama.isDestroyed){try{ama.disconnectInput();ama.destroy()}catch{}}ama=null}
/* Feed AudioMotion's smoothed LOW band into the CSS vars (--bgLo/--bgMid/--bgHi). Called once per
   frame from shBassStep. Falls back to our own kick follower (shOut) when the analyzer isn't up
   (script missing / graph not built yet), so the glow ALWAYS tracks the bass somehow. */
function amaGlowStep(t){
 if(!amaGlow)amaGlowMake(); /* safety net: glow exists even if amaBuild() never ran */
 if(!amaGlow)return;
 let lo=-1,mid=0,hi=0;
 try{if(ama&&ama.isOn){lo=ama.getEnergy("bass");mid=ama.getEnergy("lowMid");hi=ama.getEnergy("mid")}}catch{lo=-1} /* presets: bass 20–250 Hz, lowMid 250–500, mid 500–2k */
 if(!(lo>=0)){lo=Math.min(1,shOut*1.15)} /* fallback: shared kick follower from shRawLow()/shBassStep */
 const dt=Math.min(.1,Math.max(0,(t-amaLast.t)/1000));amaLast.t=t;
 const rise=1-Math.exp(-dt/.05),fall=1-Math.exp(-dt/.3); /* fast attack / smooth release */
 amaLast.lo+=(Math.min(1,lo)-amaLast.lo)*(lo>amaLast.lo?rise:fall);
 amaLast.mid+=(Math.min(1,mid)-amaLast.mid)*(mid>amaLast.mid?rise:fall);
 amaLast.hi+=(Math.min(1,hi)-amaLast.hi)*(hi>amaLast.hi?rise:fall);
 const s=amaGlow.style;s.setProperty("--bgLo",amaLast.lo.toFixed(3));
 s.setProperty("--bgMid",amaLast.mid.toFixed(3));s.setProperty("--bgHi",amaLast.hi.toFixed(3))}
/* legacy helper kept for the drift loop below: our own value first, fx.js's node only as a fallback */
function shLiveLow(){const x=shRawLow();if(x>=0)return x;const FX=window.DetuneFX;if(!FX)return 0;const an=(window.__detuneXfade&&FX.analyserB)?FX.analyserB:FX.analyser;if(!an)return 0;
 const n=an.frequencyBinCount,buf=shLiveLow.b&&(shLiveLow.b.length===n)?shLiveLow.b:(shLiveLow.b=new Uint8Array(n));an.getByteFrequencyData(buf);
 const hz=an.context.sampleRate/an.fftSize;let s=0,c=0;for(let i=Math.max(1,(20/hz)|0);i<=Math.min(n-1,(120/hz)|0);i++){s+=buf[i];c++}return c?s/c/255:0}
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
 if(px.length<6)return null;const bins={};for(const p of px){const k=p.s<=.04?"A":String((p.h/30)|0)+(p.l<.34?"L":p.l<.67?"M":"H");const e=bins[k]||(bins[k]={r:0,g:0,b:0,n:0});e.r+=p.r;e.g+=p.g;e.b+=p.b;e.n++}
 const cand=Object.values(bins).filter(e=>e.n>=2).map(e=>{const r=e.r/e.n,g=e.g/e.n,b=e.b/e.n,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,df=mx-mn;let s=df/(1-Math.abs(2*l-1)||1);s=Math.min(1.2,s*1.2);return{r,g,b,l,s,n:e.n}}).sort((a,b)=>b.n-a.n);
 const out=[];for(const c0 of cand){if(out.length>=5)break;if(out.every(o=>Math.hypot(c0.r-o.r,c0.g-o.g,c0.b-o.b)>.17))out.push(c0)}
 while(out.length<4&&cand.length&&out.length<cand.length)out.push(cand[out.length]);
 return out.map(p=>{let{r,g,b}=p;if(p.l>.7){const k=.82;r*=k;g*=k;b*=k}
 /* FIX (right half too grey): saturation boost — push every sampled colour away from the gray axis
    (keeps hue, kills flat greys) so all five blobs stay rich on BOTH halves of the screen */
 const l2=.299*r+.587*g+.114*b,mx=Math.max(r,g,b),mn=Math.min(r,g,b),k2=Math.min(1.6,.28/Math.max(.0001,mx-mn));
 r=Math.max(0,Math.min(1,l2+(r-l2)*k2));g=Math.max(0,Math.min(1,l2+(g-l2)*k2));b=Math.max(0,Math.min(1,l2+(b-l2)*k2));
 return`${Math.round(r*255)} ${Math.round(g*255)} ${Math.round(b*255)}`}).length?out.map(p=>[p.r,p.g,p.b]):null}catch(e){return null}}
/* ONLY fallback when the canvas is CORS-tainted / unreadable: neutral dark grays (never theme red) */
function meshFallback(){return["0.10 0.10 0.11","0.16 0.16 0.18","0.07 0.07 0.08","0.22 0.22 0.24","0.12 0.12 0.13"].map(s=>{const [r,g,b]=s.split(" ").map(Number);return`${Math.round(r*255)} ${Math.round(g*255)} ${Math.round(b*255)}`})}
/* spread across the WHOLE viewport (three of the five sit on the right half) so no side of the
   screen collapses into flat grey; sizes 60–84vmax let the saturated blobs bleed over each other */
const MPOS=[[46,40],[16,22],[78,24],[24,78],[74,70]],MSZ=["72vmax","60vmax","78vmax","66vmax","84vmax"],
 MF=[{a:.30,b:.22,c:.16,d:.26},{a:.24,b:.34,c:.22,d:.14},{a:.34,b:.18,c:.12,d:.28},{a:.2,b:.28,c:.32,d:.18},{a:.28,b:.22,c:.26,d:.32}];
/* the cover <img> used for sampling: prefer the shower's own copy (already loaded & same-origin),
   then #cover img, then the main-app object URL. Reading pixels from an object URL / same-origin
   blob is always safe; only a genuinely cross-origin image taints the canvas (→ neutral fallback). */
function meshSrc(){const c=(SHC&&(SHC.currentSrc||SHC.src))||"";if(c)return c;const im=$("cover")&&$("cover").querySelector("img");return(im&&im.src)||shCoverSrc()}
const meshSpd=b=>.55+(+b.dataset.t||0)*.05; /* per-blob base speed (dataset.t is a random 0..20 offset) */
/* STRUCTURE (bass reaction, priority 1): .bg-pulse (scale 1 + bass*0.25, opacity, brightness through
   --bg-bass, written by our own rAF loop — and NO CSS animation on transform here) > .lsh-spin
   (rotation only) > .lsh-blob (drift only). Three separate elements: a CSS animation can never
   override the bass transform, and the bass scale can never fight the rotation. */
function meshBuild(){if(!SHBG)return null;const w=document.createElement("div");w.className="bg-pulse";w.setAttribute("aria-hidden","true");
 const m=document.createElement("div");m.className="lsh-mesh";w.append(m);
 const sp=document.createElement("div");sp.className="lsh-spin";m.append(sp); /* slow rotating carousel (~60s/turn, bass speeds it up in meshStart) */
 /* FIX (colours didn't match the cover): sample the SHOWER'S OWN cover copy first — it is the exact
    artwork being displayed and (unlike #cover img) is guaranteed to be loaded here. */
 let cols=meshColors(SHC)||meshColors($("cover")?.querySelector("img"));
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
/* Re-tint the bass glow after a mesh rebuild (track change) so it always matches the artwork. */
function amaGlowTint(){if(!amaGlow||!mesh)return;const bl=mesh.querySelectorAll(".lsh-blob");for(let i=0;i<3;i++){const c=bl[i]&&bl[i].style.getPropertyValue("--c").trim();amaGlow.style.setProperty("--bgc"+(i+1),c||"var(--bgcN)")}}
function meshSet(v){const n=meshBuild();if(!n)return;const o=mesh;const wrap=n.parentNode; /* .bg-pulse */
 if(reduceMotion||lite){if(o)o.remove()}else{wrap.classList.add("lsh-mesh-in");if(o){o.classList.remove("lsh-mesh-in");o.classList.add("lsh-mesh-out");setTimeout(()=>o.remove(),1100)}} /* ~1s crossfade old→new colours */
 SHBG.prepend(wrap);
 /* FIX (glow vanished after track change): the mesh wrapper is PREPENDED inside .lshower-bg while
    amaGlowMake/amaBuild APPEND the glow at the end. If the glow ever loses that race it sits BELOW
    the opaque base cover img and disappears. Belt & braces: pin explicit z-tiers so DOM order can
    never bury it — pulse layer 0, analyzer canvas 0, glow 1 (still under .lshower-grid content). */
 if(amaGlow)amaGlow.style.zIndex="1";wrap.style.zIndex="0";
 mesh=n; /* --bg-bass AND --lshBass are published on the .lsh-mesh node (inherits to .bg-pulse/.lsh-spin) */
 amaGlowTint(); /* glow follows the new cover colours too */
 if(reduceMotion||lite){meshStop();shBassStart();return} /* static blobs — but the pulse still runs */
 meshStart()}
function meshLow(){/* 20–120 Hz from the OVERLAY'S OWN analyser (shWire/shRawLow above) — no longer
  depends on fx.js publishing --bass (fx.js is frozen for the whole time the shower is open). */
 const _x=shRawLow();if(_x>=0)return _x;
 /* fallback: read fx.js's nodes directly if our own graph probe is unavailable */
 /* average of the lowest analyser bins ≈ 20–120 Hz — reuses fx.js's existing
 analysers (DetuneFX.analyser / .analyserB during a crossfade); creates nothing, changes no sound */
 const FX=window.DetuneFX;if(!FX)return 0;const an=(window.__detuneXfade&&FX.analyserB)?FX.analyserB:FX.analyser;if(!an)return 0;
 const n=an.frequencyBinCount,buf=meshLow.b&&(meshLow.b.length===n)?meshLow.b:(meshLow.b=new Uint8Array(n));an.getByteFrequencyData(buf);
 const hz=an.context.sampleRate/an.fftSize;let s=0,c=0;for(let i=Math.max(1,(20/hz)|0);i<=Math.min(n-1,(120/hz)|0);i++){s+=buf[i];c++}
 return c?s/c/255:0}
function meshStop(){if(meshRaf){cancelAnimationFrame(meshRaf);meshRaf=0}meshPrev=null;meshB=0;if(mesh){mesh.style.removeProperty("--lshBass");mesh.style.removeProperty("--bg-bass")}shBassStop() /* the overlay's own bass loop stops with the overlay */}
function meshStart(){if(!mesh||reduceMotion||lite)return;
 /* reduced-motion / lite: CSS keeps the rotation animation on .lsh-spin (animation-duration is never
    changed by JS) and the pulse rides on .bg-pulse through shBassStep — so the bass loop must still run. */
 if(reduceMotion||lite){shBassStart();return}
 if(meshRaf)return;
 let last=performance.now(),acc=0,spin=mesh.spin||0;
 shBassStart();
 const step=t=>{meshRaf=requestAnimationFrame(step);let dt=(t-last)/1000;last=t;if(!(dt>0)||dt>.25)dt=.016;
  if(document.hidden)return;acc+=dt;if(acc<.033)return;acc=0; /* cap at ~30 updates/s — plenty for slow drift */
  meshB=Math.min(1,Math.max(0,shOut)); /* SHARED kick follower — measured ONCE per frame by shBassStep (own analyser, fast attack / slow release) */
  mesh.style.setProperty("--lshBass",meshB.toFixed(3));meshT+=dt*(1+meshB*.7); /* bass speeds the whole drift up (slow breathing, never flashing) */
  spin+=dt*(6+meshB*4);/* deg/s: one turn per 60s baseline (6°/s), up to ~1.67x faster on the kick */mesh.spin=spin;
  const sp0=mesh.querySelector(".lsh-spin");if(sp0)sp0.style.setProperty("--lshSpin",(spin%360).toFixed(2)+"deg");
  const tt=meshT;for(const b of (sp0||mesh).children){const i=+b.dataset.i||0,f=MF[i]||MF[0],ph=+b.dataset.ph,sp=meshSpd(b),x=tt*sp;
   b.style.setProperty("--tx",(Math.sin(x*f.a+ph)*9).toFixed(2)+"%");b.style.setProperty("--ty",(Math.cos(x*f.b+ph*1.7)*8).toFixed(2)+"%");
   const sc=1+meshB*.2;b.style.setProperty("--sx",sc.toFixed(3));b.style.setProperty("--sy",(sc*(1+.05*Math.sin(x*f.c+ph))).toFixed(3));
   b.style.opacity=(.62+meshB*.22).toFixed(3)}};
 meshRaf=requestAnimationFrame(step)}
/* FIX (left column meta): shMeta() was deleted together with the old big title/artist block above
   the progress bar, but shOpen()/shSync() still called it → "ReferenceError: shMeta is not defined"
   killed shOpen before SH.hidden=false, so L did nothing. Recreated here pointing at the NEW
   elements (#lshTitle / #lshArtist). Every DOM lookup below is null-guarded so a missing element can
   never break shOpen again; "/" artist separators become ", " and long text truncates via the CSS
   ellipsis rules on .lsh-name/.lsh-sub (extras.css) — no marquee JS needed anymore. */
function shMeta(){const t=hasTrack()?$("title")?.textContent||"":"";const ar=hasTrack()?shArtist($("artist")?.textContent||""):"";
 if(SHT){SHT.textContent=t||"Nothing playing"}
 if(SHAR){SHAR.textContent=ar||"Add a song to begin"}}
function shArt(v){const cov=$("cover"),img=cov&&cov.querySelector("img"),src=(img&&img.src)||shCoverSrc();
 if(!SHA||!SHB2)return; /* left column art nodes missing (cached/old markup): skip, never throw */
 const top=v?SHA:SHB2,bot=v?SHB2:SHA; /* two stacked copies of the blurred cover CROSSFADE (~1s CSS transition) on track change */
 if(top.getAttribute("src")!==src)top.src=src;top.classList.add("lsh-vis");top.classList.remove("lsh-gone");top.style.setProperty("--bg-bass","0"); /* fresh element inline value so coverBassStep drives THIS img from frame 1 */
 bot.classList.remove("lsh-vis");bot.classList.add("lsh-gone");shBgTop=v;
 if(SHC){if(src){SHC.src=src;SHC.style.display=""}else{SHC.removeAttribute("src");SHC.style.display="none"}}
 /* moving mesh background: rebuild (with ~1s crossfade) whenever the cover changes */
 meshSet(!!src)}
function shFsOff(){try{if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch{}}
function shOpen(v){if(v&&!hasTrack())return note("Pick a track first.");
 if(v){SH.classList.remove("lsh-out");document.body.classList.remove("lsh-out");origLoad();shArt(shBgTop);shBgTop=!shBgTop;
  shMeta();/* new #lshTitle/#lshArtist: "/" separators -> ", " + CSS ellipsis truncation (see shMeta) */
  /* pause ALL background painting while fullscreen — the shower covers everything, so the
     waveform canvas + embers are pure wasted GPU work behind it (this was the flicker/lag) */
  if(window.DetuneFX)DetuneFX.freeze=true;document.body.classList.add("lyrshow-open");
  shPrev=document.activeElement;SH.hidden=false;document.body.style.overflow="hidden";shRender();shUI();
  /* request real browser fullscreen from inside the click/keydown user-gesture, BEFORE any
     async work — a later call would be blocked by the browser. If it's denied we silently
     keep the fixed-position overlay (it already covers the whole viewport). */
  try{const p=(document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen());if(p&&p.catch)p.catch(()=>{})}catch{}
  document.documentElement.dataset.shInit="0";
  setTimeout(()=>{shTick(true);const el=SHB.children[Math.max(shIdx,0)];if(el)SHB.scrollTop=Math.max(0,el.offsetTop-SHB.clientHeight/3);document.documentElement.dataset.shInit="1";$("lshClose")?.focus()},60)}
 else{if(SH.hidden)return;shFsOff();
  /* close: fade out ONLY the root overlay element with one opacity transition — no child of the
     overlay gets its style touched (the old code put .lsh-out on SH itself and also relied on a
     keyframe animation; both could leave the left column stuck at opacity 0). */
  if(!lite){R.classList.add("lsh-out");setTimeout(()=>{R.classList.remove("lsh-out");SH.hidden=true;meshStop()},320)}else{SH.hidden=true;meshStop()}
  document.body.style.overflow="";document.body.classList.remove("lyrshow-open");if(shPrev&&document.contains(shPrev))shPrev.focus();
  if(window.DetuneFX){DetuneFX.freeze=false;if(!document.hidden)window.__detuneFxWake&&window.__detuneFxWake()}}
 SH.dispatchEvent(new CustomEvent("detune-shower",{detail:v}))}
/* ---------- PROGRESS FILL + SHUFFLE/REPEAT STATE ----------
   The bar IS an <input type="range">, so the "fill" is painted on ::-webkit-slider-runnable-track
   as a solid white layer clipped to var(--progress) (see extras.css). fx.js's global --p publisher
   is frozen while the shower is open, so we publish --progress here on EVERY timeupdate / seek /
   duration change — always exactly currentTime/duration*100 (0:29 of 2:55 → 16.6%). No CSS
   transition is set on it, and hover/drag only change the track HEIGHT (--lshH), never the width. */
const SK=$("lshSeek");
function shProgress(){if(!SK)return;
 const d=Number.isFinite(a.duration)&&a.duration>0?a.duration:0;
 const t=Math.max(0,Math.min(a.currentTime||0,d));
 const p=d?Math.min(100,t/d*100):0;
 SK.style.setProperty("--progress",p.toFixed(2)+"%");
 SK.style.setProperty("--p",p.toFixed(2)+"%"); /* legacy alias kept in sync */
 if(!shSeeking)SK.value=String(Math.round(p*10))}
/* shuffle/repeat live in app.js (#shuffle aria-pressed, #repeat text "Repeat: off|all|one").
   Mirror that REAL state onto the overlay buttons; the dots/badge are pure CSS (.on/.one). */
function shModes(){const s=$("shuffle"),r=$("repeat"),SB=$("lshShuffle"),RB=$("lshRepeat");
 if(SB&&s){const on=s.getAttribute("aria-pressed")==="true";SB.classList.toggle("on",on);SB.setAttribute("aria-pressed",String(on))}
 if(RB&&r){const m=/one/.test(r.textContent)?"one":/all/.test(r.textContent)?"all":"off";
  RB.classList.toggle("on",m!=="off");RB.classList.toggle("one",m==="one");RB.setAttribute("aria-pressed",String(m!=="off"));RB.title="Repeat ("+m+") (R)"}}
function shUI(){if(!SH||SH.hidden)return;
 const cu=$("lshCur");if(cu)cu.textContent=fmtT(a.currentTime);
 /* Apple-style: elapsed left, REMAINING as −m:ss right (falls back to total without metadata) */
 const du=$("lshDur");if(du)du.textContent=Number.isFinite(a.duration)?"-"+fmtT(Math.max(0,a.duration-a.currentTime)):fmtT(a.duration);
 shProgress();shModes();
 const playing=!a.paused&&!a.ended;
 const pi=$("lshPlayIcon");if(pi)pi.innerHTML=playing?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';
 $("lshPlay")?.setAttribute("aria-label",playing?"Pause":"Play")}
/* FIX 1b (left column invisible): shSync used to run whenever the main-app #title/#artist text
   changed — even while the shower was ALREADY open. Re-applying SH.hidden=false / re-rendering on
   top of an open overlay restarted its entrance animation from opacity:0 (the "flash then gone"
   symptom). Now a track change while open only updates CONTENT (cover src, title, artist, time,
   play/pause icon) — the left column itself is static markup in index.html and is never removed. */
function shSync(){if(!SH||SH.hidden)return;shMeta();/* new #lshTitle/#lshArtist: "/" -> ", " + CSS ellipsis (see shMeta) */shArt(shBgTop);shBgTop=!shBgTop;shRender();shUI()}
/* every overlay listener below is attached through ?. so a missing/renamed element can never throw
   at module load (a load-time throw would leave the whole extras IIFE dead and L permanently broken) */
const CLS=$("lshClose"),PLB=$("lshPlay");
if(CLS)CLS.onclick=()=>shOpen(false);
if(PLB)PLB.onclick=()=>{a.paused?a.play().catch(()=>{}):a.pause()};
$("lshPrev")?.addEventListener("click",()=>{$("prev")?.click()});
$("lshNext")?.addEventListener("click",()=>{$("next")?.click()});
/* shuffle / repeat proxy the MAIN player's buttons so there is only ONE source of truth; shModes()
   then mirrors the real state back onto these buttons (dot + 100% white when on, no dot + 60% off) */
$("lshShuffle")?.addEventListener("click",()=>{$("shuffle")?.click();shModes()});
$("lshRepeat")?.addEventListener("click",()=>{$("repeat")?.click();shModes()});
if(SK){SK.addEventListener("input",()=>{shSeeking=true;SK.classList.add("lsh-drag");if(Number.isFinite(a.duration)){a.currentTime=a.duration*(+SK.value/1000);shProgress()}});
 SK.addEventListener("change",()=>{shSeeking=false;SK.classList.remove("lsh-drag");shProgress()});SK.addEventListener("pointerup",()=>{shSeeking=false;SK.classList.remove("lsh-drag");shProgress()});
 /* keep --progress (fill %) fresh even for programmatic value writes — fx.js's global --p
    publisher is frozen while the shower is open */
 new MutationObserver(()=>{if(!SH?.hidden)shProgress()}).observe(SK,{attributes:true,attributeFilter:["value"]});shProgress()}
/* #shuffle/#repeat can also be toggled from the main app or the S/R keys — follow them live */
for(const id of["shuffle","repeat"]){const el=$(id);if(el)new MutationObserver(shModes).observe(el,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["aria-pressed","textContent"]})}
for(const ev of["timeupdate","durationchange"])a.addEventListener(ev,shUI);
a.addEventListener("seeked",shProgress); /* never leave the fill stuck at a hover/seek-preview position */
a.addEventListener("play",shUI);a.addEventListener("pause",shUI);a.addEventListener("ended",shUI);
const tEl=$("title"),arEl=$("artist");
if(tEl)new MutationObserver(shSync).observe(tEl,{childList:true,characterData:true,subtree:true});
if(arEl)new MutationObserver(shSync).observe(arEl,{childList:true,characterData:true,subtree:true});
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&!SH?.hidden){/* browser left FS (e.g. F11/Esc at OS level): keep the fixed overlay, no re-request */}});
if(SH)SH.addEventListener("click",e=>{if(e.target===SH||e.target.classList.contains("lshower-frost")||e.target.classList.contains("lshower-bg"))shOpen(false)});
if(SHB){SHB.addEventListener("click",e=>{const p=e.target.closest(".syn");if(!p)return;const ln=lines[+p.dataset.i];if(!ln)return;a.currentTime=Math.max(0,ln.t-.3);shHold=0;shTick(true)});
for(const ev of["wheel","touchmove"])SHB.addEventListener(ev,()=>shHold=Date.now()+4000,{passive:true});
SHB.addEventListener("keydown",e=>{if(!synced)return;let n=null;
 if(e.key==="ArrowDown")n=Math.min(lines.length-1,shIdx+1);
 else if(e.key==="ArrowUp")n=Math.max(0,shIdx-1);
 else if(e.key==="Home")n=0;else if(e.key==="End")n=lines.length-1;
 else if(e.key==="Enter"&&e.target.classList.contains("syn")){e.target.click();return}
 if(n!=null){e.preventDefault();const el=SHB.children[n];if(el){a.currentTime=Math.max(0,lines[n].t-.3);shHold=Date.now()+4000;shTick(true);shScrollTo(el)}}})}
a.addEventListener("timeupdate",()=>shTick());a.addEventListener("seeked",()=>shTick(true));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!SH?.hidden){shOpen(false);e.stopPropagation();return}if(e.key==="Escape"&&!P?.hidden){open(false);return}if(e.target.matches("input,textarea,select")||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.toLowerCase()==="l"){if(!SH?.hidden){shOpen(false);return}if(SH)shOpen(SH.hidden)}});
$("shortcuts")?.querySelector("ul")?.insertAdjacentHTML("beforeend","<li><b>L</b> — lyrics</li>");
load();
})();
/* DEBUG-ONLY probe: window.DetuneAMA.bass() → current LOW-band value driving the glow.
   kill() is hoisted so it's always defined, even if this line somehow runs before amaKill. */
window.DetuneAMA={kill:()=>amaKill(),bass:()=>amaLast.lo,cover:()=>({art:SHA?getComputedStyle(SHA).getPropertyValue("--bg-bass"):"-",artB:SHB2?getComputedStyle(SHB2).getPropertyValue("--bg-bass"):"-",covLo:+covLo.toFixed(3)}),
 state:()=>({amaLive:!!(ama&&ama.isOn),lo:+amaLast.lo.toFixed(3),kick:+shOut.toFixed(3),wired:!!shAnalyser,glow:!!amaGlow,graph:!!(window.DetuneApp&&DetuneApp.audioGraph)})};
