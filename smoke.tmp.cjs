const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://localhost/'});
const w=dom.window;
w.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){}});
let rafCbs=[]; w.requestAnimationFrame=cb=>{rafCbs.push(cb);return rafCbs.length};
w.cancelAnimationFrame=id=>{};
for(const f of ['core.js','fx.js','extras.js']){ try{w.eval(fs.readFileSync(f,'utf8'))}catch(e){console.log(f+' eval err:',e.message)} }
const d=w.document;
d.getElementById('title').textContent='Test Song';
d.getElementById('artist').textContent='Test Artist';
w.localStorage.setItem('detune-lyr:Test Song|Test Artist','[00:01.00]first line here\n[00:05.00]second longer line of text goes on\n[00:09.00]third line');
Object.defineProperty(d.documentElement,'requestFullscreen',{value:()=>Promise.resolve(),configurable:true,writable:true});
// open the shower directly via the L key handler path (target=document.body so .matches exists)
d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'l',bubbles:true}));
const SH=d.getElementById('lshower');
console.log('RESULT shower visible:', !SH.hidden);
setTimeout(()=>{
  const audio=d.getElementById('audio');
  const SHB=d.getElementById('lshBody');
  console.log('RESULT lines rendered:', SHB.children.length);
  Object.defineProperty(audio,'currentTime',{value:3,configurable:true,writable:true});
  Object.defineProperty(audio,'paused',{value:true,configurable:true});
  audio.dispatchEvent(new w.Event('timeupdate'));
  let cbs=rafCbs.splice(0); cbs.forEach(cb=>{try{cb(w.performance.now())}catch(e){console.log('frame err',e.message)}});
  console.log('RESULT fill@t3 (expect 50.00%):', SHB.style.getPropertyValue('--lshFill'));
  console.log('RESULT line0 class:', SHB.children[0].className);
  audio.currentTime=6;
  audio.dispatchEvent(new w.Event('seeked'));
  cbs=rafCbs.splice(0); cbs.forEach(cb=>{try{cb(w.performance.now())}catch(e){console.log('frame err',e.message)}});
  console.log('RESULT fill@t6 (expect 25.00%):', SHB.style.getPropertyValue('--lshFill'));
  console.log('RESULT classes:', SHB.children[0].className,'|',SHB.children[1].className);
  // last line beyond all timestamps -> fill should reach 100 at t=13 (s=9,e=9+4 capped)
  audio.currentTime=13;
  audio.dispatchEvent(new w.Event('seeked'));
  cbs=rafCbs.splice(0); cbs.forEach(cb=>{try{cb(w.performance.now())}catch(e){}});
  console.log('RESULT fill@t13 last-line cap (expect 100.00%):', SHB.style.getPropertyValue('--lshFill'));
  process.exit(0);
},150);
