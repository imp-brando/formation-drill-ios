const mock=()=>{
  window.__gum=0; window.__srs=[];
  class FakeSR{ constructor(){ window.__srs.push(this); this.running=false; }
    start(){ if(this.running) throw new Error('already'); this.running=true; setTimeout(()=>this.onstart&&this.onstart(),5); }
    stop(){ setTimeout(()=>{ this.running=false; this.onend&&this.onend(); },5); }
    abort(){ this.running=false; this.onend&&this.onend(); }
    emit(list){ // list: [[text,isFinal],...] full results array (Android-style cumulative)
      const results=list.map(([t,f])=>{ const r=[{transcript:t,confidence:.9}]; r.isFinal=f; return r; });
      this.onresult && this.onresult({resultIndex:Math.max(0,results.length-1), results}); }
    end(){ this.running=false; this.onend&&this.onend(); } }
  window.webkitSpeechRecognition=FakeSR; window.SpeechRecognition=FakeSR;
  const md=navigator.mediaDevices||{}; Object.defineProperty(navigator,'mediaDevices',{value:md});
  md.getUserMedia=async(c)=>{ window.__gum++; window.__lastConstraints=c; const ac=new (window.AudioContext)(); const d=ac.createMediaStreamDestination(); const s=d.stream; window.__stream=s; return s; };
};
async function page(){}
