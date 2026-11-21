// Option A: voice-burst execution. Prep recognised -> armed; the first sharp burst on the meter executes.
// Measures onset -> registration -> action step, checks PICAA (correct foot, exactly 1 additional step),
// compares with words-only timing, and checks the false-trigger guards, confirm and cancel.
const puppeteer=require('puppeteer-core'), P=require('path');
const CHROME_DELAY=600;   // assumed Chrome delay from end of "MARCH" to its interim text (can't be measured here)
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const check=(ok,msg)=>{ console.log((ok?'PASS ':'FAIL ')+msg); if(!ok) fails++; };
 const res=await p.evaluate((CHROME_DELAY)=>{
  let slot=0;
  const say=(t,fin)=>{ const r=[{transcript:t,confidence:.9}]; r.isFinal=!!fin; const results=[]; for(let i=0;i<=slot;i++) results.push(r); FG.handleResult({resultIndex:slot++,results}); };
  const quiet=ms=>{ for(let t=0;t<ms;t+=25){ FG.sim(25); FG.frame(-58); } };
  const loud=(ms,db=-38)=>{ for(let t=0;t<ms;t+=25){ FG.sim(25); FG.frame(db); } };
  const setup=(mode)=>{ FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none"; FG.meter(true); FG.setExecMode(mode);
    FG.sim(800); say("forward march",true); FG.sim(2400); quiet(200); };
  const foot=k=>(((k%2)+2)%2===0)?"L":"R";
  const cases=[["column left","L","colL"],["column right","R","colR"],["rear","R","rear"],["right flank","R","rflank"],["platoon","either","halt"]];
  const out={};
  for(const [prep,want,id] of cases){
   const rows={burst:[], words:[]};
   for(const mode of ["burst","words"]) for(let trial=0;trial<16;trial++){
    setup(mode); quiet(Math.round(FG.clock.period*2*trial/16));
    window.__burstLog=[]; window.__execLog=[]; FG.G.pendingAction=null;
    say(prep,true);                  // Chrome: the prep, at the natural pause
    quiet(300);                      // the pause
    const per=FG.clock.period, kNow=FG.clock.k, lastT=FG.clock.lastT, tBeat=k=>lastT+(k-(kNow-1))*per;
    const T0=FG.now()+25;           // onset of "MARCH"
    const full=prep+(id==="halt"?" halt":" march");
    if(mode==="burst"){ loud(300); quiet(200); say(full,false); }    // Chrome's text arrives later: confirm only
    else { loud(300); quiet(CHROME_DELAY-300); say(full,false); }
    let el=0; while(el<4000 && !(FG.G.pendingAction && FG.G.pendingAction.id===id && FG.G.pendingAction.actT)){ FG.sim(16); el+=16; }
    const pa=FG.G.pendingAction, ex=window.__execLog.filter(e=>e.id===id);
    if(!pa||!pa.actT){ rows[mode].push({fail:true}); continue; }
    rows[mode].push({reg: mode==="burst" ? Math.round(window.__burstLog[0].firedT-T0) : CHROME_DELAY,
      toAction:Math.round(pa.actT-T0), addl:+(pa.actBeat-pa.kE).toFixed(2), footOK: want==="either"||foot(pa.kE)===want, execs:ex.length,
      onsetBeat: Math.round((T0-lastT)/per)+(kNow-1), kE:pa.kE});
   }
   const sum=a=>{ const ok=a.filter(r=>!r.fail); const avg=f=>Math.round(ok.reduce((s,r)=>s+r[f],0)/ok.length);
     return {n:ok.length, regAvg:avg("reg"), actAvg:avg("toAction"), actMax:Math.max(...ok.map(r=>r.toAction)), addl:[Math.min(...ok.map(r=>r.addl)),Math.max(...ok.map(r=>r.addl))], footOK:ok.every(r=>r.footOK), single:ok.every(r=>r.execs===1)}; };
   out[prep]={burst:sum(rows.burst), words:sum(rows.words)};
  }
  // ---- guards ----
  const g={};
  setup("burst"); window.__burstLog=[]; loud(300); quiet(300); g.noPrep=window.__burstLog.length;                       // burst without a prep
  setup("burst"); window.__burstLog=[]; loud(400); say("column left",false); loud(600); g.noGap=window.__burstLog.length;     // prep still being spoken, talking straight on: no gap
  setup("burst"); window.__burstLog=[]; say("column left",true); quiet(300); loud(300,-52); g.soft=window.__burstLog.length; // only 8 dB: not a burst
  setup("burst"); window.__burstLog=[]; say("column left",true); quiet(300); loud(25); quiet(300); g.click=window.__burstLog.length;   // 25 ms click
  setup("burst"); window.__burstLog=[]; say("column left",true); quiet(3700); loud(300); g.late=window.__burstLog.length; // after the 3.5 s window
  // confirm: no double execution
  setup("burst"); window.__execLog=[]; say("column left",true); quiet(300); loud(300); quiet(300); say("column left march",false); FG.sim(1500);
  g.confirmExecs=window.__execLog.filter(e=>e.id==="colL").length; g.confirmStatus=document.getElementById('srStatus').textContent;
  // cancel: "as you were" right after the burst, before the action step
  setup("burst"); window.__execLog=[]; FG.G.pendingAction=null; say("column left",true); quiet(300); const h0=FG.state().heading; loud(150); say("as you were",true); FG.sim(2500);
  g.cancel={headingBefore:h0, headingAfter:FG.state().heading, pending:FG.G.pendingAction, verdict:document.getElementById('verdict').textContent};
  return {out,g};
 },CHROME_DELAY);
 for(const [k,v] of Object.entries(res.out)){
  const okB=v.burst.n===16 && v.burst.footOK && v.burst.single && v.burst.addl[0]>=0.93 && v.burst.addl[1]<=1.07;
  const okW=v.words.n===16 && v.words.footOK && v.words.addl[0]>=0.93 && v.words.addl[1]<=1.07;
  check(okB&&okW, `${k.padEnd(13)} burst ${JSON.stringify(v.burst)}\n${' '.repeat(19)}words ${JSON.stringify(v.words)}`);
 }
 const g=res.g;
 check(g.noPrep===0,'no prep: burst ignored'); check(g.noGap===0,'no quiet gap after the prep: ignored'); check(g.soft===0,'8 dB rise: ignored');
 check(g.click===0,'25 ms click: ignored'); check(g.late===0,'burst after the 3.5 s window: ignored');
 check(g.confirmExecs===1, `Chrome text after the burst confirms, executes once (${g.confirmExecs}): ${g.confirmStatus}`);
 check(g.cancel.headingAfter===g.cancel.headingBefore, `"as you were" before the action step cancels: heading ${g.cancel.headingBefore} -> ${g.cancel.headingAfter}`);
 console.log('errors',errs); await b.close(); process.exit(fails||errs.length?1:0);
})();
