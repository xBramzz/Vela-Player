const fs=require("fs");const vm=require("vm");const {JSDOM}=require("jsdom");
const dom=new JSDOM("<!doctype html><html><body></body></html>",{pretendToBeVisual:true});
const win=dom.window;let ctx;
const audioNode=(ac)=>({context:ac,connect(d){return d},disconnect(){}});
const mkAnalyser=()=>Object.assign(audioNode(ctx),{fftSize:1024,frequencyBinCount:512,minDecibels:-100,maxDecibels:-30,smoothingTimeConstant:.8,channelCount:2,channelCountMode:"max",channelInterpretation:"speakers",getFloatFrequencyData(a){for(let i=0;i<a.length;i++)a[i]=i<40?-45:-120},getByteFrequencyData(a){for(let i=0;i<a.length;i++)a[i]=i<40?200:0},getFloatTimeDomainData(){},getByteTimeDomainData(){}});
class GainParam{constructor(){this.value=1}setValueAtTime(){}linearRampToValueAtTime(){}cancelScheduledValues(){}}
class GainNode{constructor(){this.gain=new GainParam();this.context=ctx}connect(n){return n}disconnect(){}}
ctx={sampleRate:48000,state:"running",currentTime:0,destination:audioNode(null),createAnalyser:mkAnalyser,createGain:()=>new GainNode(),createBiquadFilter:()=>audioNode(ctx),createDynamicsCompressor:()=>audioNode(ctx),createStereoPanner:()=>audioNode(ctx),createConvolver:()=>audioNode(ctx),createChannelSplitter:()=>audioNode(ctx),createChannelMerger:()=>audioNode(ctx),createMediaStreamAudioSourceNode:()=>audioNode(ctx),createBuffer:(c,l)=>({getChannelData:()=>new Float32Array(l)}),resume:async()=>{}};
win.AudioContext=function(){return ctx};win.webkitAudioContext=win.AudioContext;
// minimal canvas 2d stub so the internal (off-DOM) canvas works with useCanvas:false
win.HTMLCanvasElement.prototype.getContext=function(){const g=new Proxy({},{get:(t,p)=>p==="canvas"?{width:640,height:270}:(p==="measureText"?()=>({width:10}):typeof t[p]!=="undefined"?t[p]:()=>{})});return g};
const master=new GainNode();
const code=fs.readFileSync("/workspace/audiomotion-analyzer.min.js","utf8");
// run in a Function whose `this` is window and where exports/define are UNDEFINED -> UMD browser branch
const fn=new Function("window","self","globalThis","AudioMotionAnalyzer",code+";return AudioMotionAnalyzer");
// simpler: emulate browser global by deleting module/exports from scope — jsdom eval already lacks them,
// but win.eval saw typeof exports undefined yet returned false earlier because factory used mod.exports.default on GLOBAL branch. Retry via direct script injection:
const s=win.document.createElement("script");s.textContent=code;try{win.eval(code)}catch(e){console.log("eval err",e.message)}
console.log("lib loaded:",typeof win.AudioMotionAnalyzer==="function");
const AMA=win.AudioMotionAnalyzer;
try{
 const ama=new AMA({source:master,connectSpeakers:false,useCanvas:false,fftSize:8192,minFreq:20,maxFreq:16000,smoothing:.7});
 console.log("constructed OK | audioCtx===ctx(shared):",ama.audioCtx===ctx,"| isOn:",ama.isOn);
 ama.toggleAnalyzer(true);
 setTimeout(()=>{const e1=ama.getEnergy("bass");
  console.log('after rAF frames: getEnergy("bass") =',e1,"-> numeric:",typeof e1==="number"&&!Number.isNaN(e1));
  process.exit(0)},200);
}catch(e){console.log("CTOR/RUN ERROR:",e.constructor.name+": "+e.message);process.exit(1)}
