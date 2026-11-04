const fs=require("fs");
const {JSDOM}=require("jsdom");
const dom=new JSDOM("<!doctype html><html><body></body></html>",{pretendToBeVisual:true});
const win=dom.window;
// stub Web Audio only (jsdom has none)
let ctx;
const audioNode=(ac)=>({context:ac,connect(d){return d},disconnect(){}});
const mkAnalyser=()=>Object.assign(audioNode(ctx),{fftSize:1024,frequencyBinCount:512,minDecibels:-100,maxDecibels:-30,smoothingTimeConstant:.8,channelCount:2,channelCountMode:"max",channelInterpretation:"speakers",getFloatFrequencyData(a){for(let i=0;i<a.length;i++)a[i]=i<20?-60:-120},getByteFrequencyData(a){for(let i=0;i<a.length;i++)a[i]=i<20?200:0},getFloatTimeDomainData(){},getByteTimeDomainData(){}});
class GainNode{constructor(){this.gain={value:1,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}}}connect(n){if(n&&n.context===undefined)n.context=ctx;return n}disconnect(){}}
ctx={sampleRate:48000,state:"running",currentTime:0,destination:audioNode(null),createAnalyser:mkAnalyser,createGain:()=>new GainNode(),createBiquadFilter:()=>audioNode(ctx),createDynamicsCompressor:()=>audioNode(ctx),createStereoPanner:()=>audioNode(ctx),createConvolver:()=>audioNode(ctx),createChannelSplitter:()=>audioNode(ctx),createChannelMerger:()=>audioNode(ctx),createMediaStreamAudioSourceNode:()=>audioNode(ctx),resume:async()=>{}};
win.AudioContext=function(){return ctx};
const master=new GainNode();
win.eval(fs.readFileSync("/workspace/audiomotion-analyzer.min.js","utf8"));
console.log("lib loaded in jsdom:",typeof win.AudioMotionAnalyzer==="function");
try{
 const ama=new win.AudioMotionAnalyzer({source:master,connectSpeakers:false,useCanvas:false,fftSize:8192,minFreq:20,maxFreq:16000,smoothing:.7});
 console.log("constructed OK | isOn:",ama.isOn,"| destroyed:",!!ama.isDestroyed);
 ama.toggleAnalyzer(true);
 console.log("toggle(true) -> isOn:",ama.isOn);
 setTimeout(()=>{
  const e1=ama.getEnergy("bass");
  console.log("after ~150ms of rAF frames: getEnergy(\"bass\") =",e1,"-> numeric:",typeof e1==="number"&&!Number.isNaN(e1));
  ama.toggleAnalyzer(false);console.log("toggle(false) ok -> isOn:",ama.isOn);
  ama.destroy();console.log("destroy ok -> isDestroyed:",!!ama.isDestroyed);
  process.exit(0);
 },150);
}catch(e){console.log("CTOR/RUN ERROR:",e.constructor.name+": "+e.message);process.exit(1)}
