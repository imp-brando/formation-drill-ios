// NOTE: times the LEFT-most front soldier. For column RIGHT that is the outer file, which (square pivots) marches ~3 steps to its own pivot point. PICAA timing of the pivot file is checked in tests/picaa.js.
// Command-to-action latency through the real speech-result path, in virtual time.
// For each command, the speech result arrives at 8 different points in the beat cycle.
const puppeteer=require('puppeteer-core'), P=require('path');
const tag=process.argv[2]||'now';
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 const res=await p.evaluate(()=>{
  const out={};
  let slot=0;   // every utterance in its own result slot, like a fresh recognition result
  const say=t=>{ const r=[{transcript:t,confidence:.9}]; r.isFinal=true; const results=[]; for(let i=0;i<=slot;i++) results.push(r); FG.handleResult({resultIndex:slot++,results}); };
  const front=()=>FG.F.ranks[0].sol.find(Boolean);
  const cases=[
    ["forward march", false, ()=>Math.hypot(front().x-st.x0,front().y-st.y0)>0.02],
    ["column left march", true, ()=>Math.abs(front().face-st.h0)>0.02],
    ["column right march", true, ()=>Math.abs(front().face-st.h0)>0.02],
    ["counter column march", true, ()=>FG.F.mode==="counter" && FG.F.ranks.some(rk=>rk.sol.some(s=>s&&Math.abs(s.face-st.h0)>0.02))],
    ["rear march", true, ()=>FG.G.move==="pivot"],
    ["platoon halt", true, ()=>FG.G.move==="closing"||FG.G.move==="halt"],
  ];
  var st={};
  for(const [cmd, marching, moved] of cases){
    const lat=[], beats=[], execLat=[];
    for(let trial=0;trial<8;trial++){
      FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none";
      FG.sim(800);   // past the 600 ms repeat guard
      if(marching){ say("forward march"); FG.sim(2600); }
      // place the result at a different phase of the 2-beat (L/R) cycle each trial
      FG.sim(Math.round(FG.clock.period*2*trial/8)+17*trial%5);
      window.__execLog=[];
      if(marching && FG.G.move!=="forward") throw new Error("not marching before "+cmd+" trial "+trial+": "+document.getElementById("verdict").textContent+" | "+document.getElementById("detail").textContent+" | "+document.getElementById("srStatus").textContent+" move="+FG.G.move);
      st.x0=front().x; st.y0=front().y; st.h0=front().face;
      const t0=performance.now(), simT0=FG.clock.lastT;
      const k0=FG.clock.k;
      let tSaid; FG.sim(0);
      // say it "now" in virtual time
      say(cmd); tSaid=FG.clock.lastT; const nowV=(()=>{ return FG.now? FG.now() : 0; })();
      let el=0, hit=null;
      while(el<6000){ FG.sim(16); el+=16; if(moved()){ hit=el; break; } }
      const ex=window.__execLog.find(e=>e.id!=="forward"||cmd.startsWith("forward"));
      lat.push(hit); beats.push(+(hit/FG.clock.period).toFixed(2));
    }
    out[cmd]={period:FG.clock.period, msAvg:Math.round(lat.reduce((a,b)=>a+b,0)/lat.length), msMax:Math.max(...lat), beatsAvg:+(lat.reduce((a,b)=>a+b,0)/lat.length/FG.clock.period).toFixed(2), beatsMax:+(Math.max(...lat)/FG.clock.period).toFixed(2)};
  }
  return out;
 });
 console.log(tag); for(const [k,v] of Object.entries(res)) console.log(' ',k.padEnd(22),JSON.stringify(v));
 console.log('errors',errs); await b.close();
})();
