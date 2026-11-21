// PICAA timing: execution word arrives as an INTERIM speech result at 16 points across the L/R cycle.
// Checks: command of execution anchored on the correct foot, exactly ONE additional step, action on kE+1.
// Reports ms/beats from recognition to the start of the additional step and to the action step.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 const res=await p.evaluate(()=>{
  let slot=0;
  const say=(t,fin)=>{ const r=[{transcript:t,confidence:.9}]; r.isFinal=!!fin; const results=[]; for(let i=0;i<=slot;i++) results.push(r); FG.handleResult({resultIndex:slot++,results}); };
  const cmds=[["column left march","L"],["column right march","R"],["column half left march","L"],["rear march","R"],["right flank march","R"],["left flank march","L"],["platoon halt","either"],["counter column march","either"],["mark time march","either"],["change step march","R"],["colm lef harch","L"],["palm left much","L"],["reah harch","R"],["ri flank hut","R"],["platoon haaalt","either"]];
  const out={}, foot=k=>(((k%2)+2)%2===0)?"L":"R";
  for(const [cmd,want] of cmds){
    const rows=[];
    for(let trial=0;trial<16;trial++){
      FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none";
      FG.sim(800); say("forward march",true); FG.sim(2400);
      FG.sim(Math.round(FG.clock.period*2*trial/16));
      if(FG.G.move!=="forward") return {error:"not marching before "+cmd};
      const h=FG.now(), per=FG.clock.period, kNow=FG.clock.k, lastT=FG.clock.lastT;
      FG.G.pendingAction=null;
      say(cmd,false);                                       // interim result with the execution word
      let el=0; while(el<4000 && !(FG.G.pendingAction && FG.G.pendingAction.id!=="forward" && FG.G.pendingAction.actT)){ FG.sim(8); el+=8; }
      const pa=FG.G.pendingAction; if(!pa||!pa.actT) return {error:"no action for "+cmd+" trial "+trial};
      const tBeat=k=>lastT+(k-(kNow-1))*per;
      rows.push({kE:pa.kE, footOK: want==="either" || foot(pa.kE)===want, addlSteps:+(pa.actBeat-pa.kE).toFixed(2),
        msToAddl:Math.round(tBeat(pa.kE)-h), msToAction:Math.round(pa.actT-h), per});
    }
    const avg=a=>a.reduce((x,y)=>x+y,0)/a.length, per=rows[0].per;
    const toA=rows.map(r=>r.msToAction), toAd=rows.map(r=>r.msToAddl);
    out[cmd]={footOK:rows.every(r=>r.footOK), addlSteps:[Math.min(...rows.map(r=>r.addlSteps)),Math.max(...rows.map(r=>r.addlSteps))],
      toAdditional_ms:{avg:Math.round(avg(toAd)),min:Math.min(...toAd),max:Math.max(...toAd)},
      toAction_ms:{avg:Math.round(avg(toA)),min:Math.min(...toA),max:Math.max(...toA)},
      toAction_beats:{avg:+(avg(toA)/per).toFixed(2),max:+(Math.max(...toA)/per).toFixed(2)}, beat_ms:per};
  }
  return out;
 });
 if(res.error){ console.log('ERROR',res.error); process.exit(1); }
 let bad=0;
 for(const [k,v] of Object.entries(res)){ const ok=v.footOK && v.addlSteps[0]>=0.93 && v.addlSteps[1]<=1.07; if(!ok) bad++; console.log((ok?'PASS ':'FAIL ')+k.padEnd(24),JSON.stringify(v)); }
 console.log('errors',errs); await b.close(); process.exit(bad||errs.length?1:0);
})();
