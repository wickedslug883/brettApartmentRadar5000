
const $=s=>document.querySelector(s);
const canvas=$("#radar"), ctx=canvas.getContext("2d");
let audio, analyser, bins, running=false, locked=false, targetHz=null, currentDb=-120, peakHz=0;
let baseline=-90,lastDetect=0,sweep=0,pulses=[];
const sensitivities=[{name:"Low",delta:18,floor:-45},{name:"Medium",delta:12,floor:-55},{name:"High",delta:8,floor:-65}];

function resizeCanvas(){
 const dpr=Math.min(devicePixelRatio||1,2), size=canvas.clientWidth;
 canvas.width=size*dpr; canvas.height=size*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resizeCanvas); setTimeout(resizeCanvas,0);

function draw(){
 const w=canvas.clientWidth,h=w,cx=w/2,cy=h/2,R=w*.47;
 ctx.clearRect(0,0,w,h);
 ctx.strokeStyle="rgba(70,255,130,.28)";ctx.lineWidth=1;
 for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(cx,cy,R*i/4,0,Math.PI*2);ctx.stroke()}
 for(let a=0;a<Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);ctx.stroke()}
 sweep=(sweep+.018)%(Math.PI*2);
 let grad=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
 grad.addColorStop(0,"rgba(55,255,120,.14)");grad.addColorStop(1,"rgba(55,255,120,0)");
 ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,sweep-.38,sweep);ctx.closePath();ctx.fill();
 ctx.strokeStyle="rgba(95,255,145,.8)";ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sweep)*R,cy+Math.sin(sweep)*R);ctx.stroke();

 if(running && targetHz){
   const normalized=Math.max(0,Math.min(1,(currentDb+90)/60));
   const radius=R*(1-normalized*.82);
   const ang=((targetHz%997)/997)*Math.PI*2; // visual marker angle only; NOT direction
   const x=cx+Math.cos(ang)*radius,y=cy+Math.sin(ang)*radius;
   ctx.fillStyle="rgba(120,255,165,.95)";ctx.shadowColor="#39ff7a";ctx.shadowBlur=14;
   ctx.beginPath();ctx.arc(x,y,5+normalized*5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 }
 requestAnimationFrame(draw);
}
draw();

$("#start").onclick=async()=>{
 try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   audio=new (window.AudioContext||window.webkitAudioContext)();
   await audio.resume();
   const src=audio.createMediaStreamSource(stream);
   analyser=audio.createAnalyser(); analyser.fftSize=16384; analyser.smoothingTimeConstant=.5;
   src.connect(analyser); bins=new Float32Array(analyser.frequencyBinCount);
   running=true; $("#start").textContent="LISTENING";$("#start").disabled=true;$("#lock").disabled=false;
   $("#status").textContent="LIVE";$("#status").classList.add("on"); analyze();
 }catch(e){
   alert("Microphone access failed. Open this site from your GitHub Pages HTTPS URL, then allow microphone permission in Chrome.\n\n"+e.message);
 }
};

function bandPeak(min,max){
 const binHz=audio.sampleRate/analyser.fftSize;
 let a=Math.max(1,Math.floor(min/binHz)),b=Math.min(bins.length-1,Math.ceil(max/binHz)),best=a;
 for(let i=a;i<=b;i++) if(bins[i]>bins[best]) best=i;
 return {hz:best*binHz,db:bins[best]};
}
function analyze(){
 if(!running)return;
 analyser.getFloatFrequencyData(bins);
 let min=+$("#minFreq").value,max=+$("#maxFreq").value;
 if(min>=max) max=min+500;
 let p;
 if(locked && targetHz){
   p=bandPeak(Math.max(100,targetHz-120),targetHz+120);
 } else p=bandPeak(min,max);
 peakHz=p.hz;currentDb=p.db;
 baseline=.997*baseline+.003*currentDb;
 targetHz=locked?targetHz:peakHz;
 $("#freq").textContent=Math.round(targetHz).toLocaleString();
 $("#db").textContent=currentDb.toFixed(1)+" dBFS";$("#peak").textContent=Math.round(peakHz).toLocaleString()+" Hz";
 const n=Math.max(0,Math.min(1,(currentDb+90)/60));
 $("#strength").textContent=n>.78?"VERY STRONG":n>.58?"STRONG":n>.38?"MEDIUM":n>.2?"WEAK":"VERY WEAK";
 const s=sensitivities[+$("#sensitivity").value];
 if(!locked && currentDb>s.floor && currentDb>baseline+s.delta && Date.now()-lastDetect>1800){
   lastDetect=Date.now(); addEvent(peakHz,currentDb); targetHz=peakHz;
   if(navigator.vibrate)navigator.vibrate(100);
 }
 requestAnimationFrame(analyze);
}
function addEvent(hz,db){
 const log=$("#log"); if(log.querySelector(".empty"))log.innerHTML="";
 const e=document.createElement("div");e.className="event";
 e.innerHTML=`<span>${new Date().toLocaleTimeString()}</span><span class="hot">${Math.round(hz).toLocaleString()} Hz</span><span>${db.toFixed(1)} dBFS</span>`;
 log.prepend(e);
}
$("#lock").onclick=()=>{
 locked=!locked;
 if(locked){targetHz=peakHz;$("#lock").textContent="UNLOCK TARGET";$("#lockLabel").textContent=Math.round(targetHz)+" Hz"}
 else{$("#lock").textContent="LOCK TARGET";$("#lockLabel").textContent="AUTO"}
};
$("#clear").onclick=()=>$("#log").innerHTML='<div class="empty">Waiting for detections…</div>';
function ranges(){let a=+$("#minFreq").value,b=+$("#maxFreq").value;if(a>b-500){if(event?.target?.id==="minFreq")$("#minFreq").value=b-500;else $("#maxFreq").value=a+500}$("#rangeText").textContent=($("#minFreq").value/1000).toFixed(1)+"–"+($("#maxFreq").value/1000).toFixed(1)+" kHz"}
$("#minFreq").oninput=ranges;$("#maxFreq").oninput=ranges;
$("#sensitivity").oninput=()=>$("#sensText").textContent=sensitivities[+$("#sensitivity").value].name;
