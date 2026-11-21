// Before FALL IN: scattered soldiers stroll, walls/bumps never break anything, other commands are ignored,
// the drill sergeant stands still in a corner watching. FALL IN (and sound-alikes): everyone double-times
// to place; result = 4x4 column at attention, DS centred 2 steps off the LEFT flank, game proceeds.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 // sound-alikes
 const yes=["fall in","fallin","fall inn","call in","ball in","paul in","hall in","fa in","falling","fall on","platoon fall in","fawn in"];
 const no=["fall","call in sick","fall in love","i'll call in later","ball in the court","falling down","fall back"];
 const pr=await p.evaluate((y,n)=>({y:y.map(t=>[t,FG.parse(t)]), n:n.map(t=>[t,FG.parse(t)])}),yes,no);
 ck(pr.y.every(x=>x[1]==="fallin"), "Fall in sound-alikes recognised: "+pr.y.map(x=>x[0]+"="+x[1]).join(", "));
 ck(pr.n.every(x=>x[1]!=="fallin"), "chatter not taken as Fall in: "+pr.n.map(x=>x[0]+"="+x[1]).join(", "));
 for(const mode of ["snake","drill"]){
  const r=await p.evaluate(mode=>{
   window.__noWalls=false; FG.startHeadless(mode,true); FG.setRecOn(true); FG.settings.sens="ds";
   const out={phase0:FG.phase(), recruits0:FG.G.recruits.length};
   const s0=FG.sgtRaw(), b=FG.bounds(), pos0=JSON.stringify(FG.state().soldiers);
   out.corner = Math.min(Math.abs(s0.x-b.x0),Math.abs(s0.x-b.x1))<1.6 && Math.min(Math.abs(s0.y-b.y0),Math.abs(s0.y-b.y1))<4.6;
   // force soldiers against the walls: no break
   if(mode==="snake"){ const sol=FG.F.ranks.flatMap(rk=>rk.sol.filter(Boolean)); sol[0].x=0.36; sol[1].y=0.36; sol[2].x=sol[3].x; sol[2].y=sol[3].y; }
   let sgtMoved=0, minWallOk=true; const sx=s0.x, sy=s0.y;
   // other commands are ignored before fall in
   ["forward march","column left march","right flank march","platoon halt","counter column march"].forEach(t=>FG.cmd(t));
   for(let i=0;i<60;i++){ FG.sim(250); const s=FG.sgtRaw(); sgtMoved=Math.max(sgtMoved,Math.hypot(s.x-sx,s.y-sy)); }
   out.over=FG.G.over; out.phase1=FG.phase(); out.move=FG.G.move; out.recruits1=FG.G.recruits.length;
   out.moved = JSON.stringify(FG.state().soldiers)!==pos0; out.sgtMoved=+sgtMoved.toFixed(3);
   const st=FG.state(); out.inField = mode!=="snake" || st.soldiers.every(([x,y])=>x>0.3&&y>0.3&&x<b.x1+1-0.3&&y<b.y1+1-0.3);
   // watching: DS faces the group's centre
   let cx=0,cy=0; st.soldiers.forEach(s=>{cx+=s[0];cy+=s[1];}); cx/=st.soldiers.length; cy/=st.soldiers.length;
   const s1=FG.sgtRaw(), want=Math.atan2(cx-s1.x,-(cy-s1.y)); out.watchErr=Math.abs(((want-s1.face)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI)*57.3;
   return out; },mode);
  ck(r.phase0==="scatter" && r.phase1==="scatter" && !r.over, `${mode}: scatter phase, soldiers on/over the wall and bumping: no formation broke (over=${r.over})`);
  ck(r.moved && r.inField, `${mode}: soldiers stroll and stay on the field`);
  ck(r.move==="halt" && r.recruits0===0 && r.recruits1===0, `${mode}: drill commands before Fall in ignored; no recruits yet (move=${r.move})`);
  ck(r.corner && r.sgtMoved<0.01 && r.watchErr<20, `${mode}: drill sergeant still in a corner (moved ${r.sgtMoved}), watching the group (facing off by ${r.watchErr.toFixed(0)}°)`);
  if(mode==="snake") await shot('fallin-1-scatter');
  // FALL IN (sound-alike, inflection level Drill Sergeant: one-part here, no inflection check)
  const f=await p.evaluate(()=>{ FG.cmd("ball in"); const o={phase:FG.phase()}; let maxRun=0, sgtRun=false, legRate=0;
    const a=FG.F.ranks.flatMap(rk=>rk.sol.filter(Boolean));
    for(let i=0;i<12;i++){ FG.sim(50); }
    const run=a.filter(s=>s.run); o.running=run.length; sgtRun=!!FG.sgtRaw().run;
    // leg cadence of a running soldier: phase units (steps) per second
    if(run[0]){ const s=run[0], ph0=s.walkPh, t0=FG.now(); FG.sim(100); let d=s.walkPh-ph0; if(d<0) d+=2; legRate=d/((FG.now()-t0)/1000); }
    o.sgtRun=sgtRun; o.legRate=+legRate.toFixed(2); return o; });
  ck(f.phase==="forming" && f.running>=8 && f.sgtRun, `${mode}: FALL IN ("ball in"): soldiers (${f.running} running) and drill sergeant double-time`);
  ck(f.legRate>2.6 && f.legRate<3.4, `${mode}: double-time leg cadence ${f.legRate} steps/s (~180/min)`);
  if(mode==="snake"){ await p.evaluate(()=>FG.sim(1800)); await shot('fallin-2-double-time'); }
  const e=await p.evaluate(()=>{ let t=0; while(FG.phase()!=="formed" && t<30000){ FG.sim(100); t+=100; }
    const o={phase:FG.phase(), ms:t, sgt:FG.sgt(), W:FG.F.W, ranks:FG.F.ranks.length, n:FG.state().soldiers.length, posture:FG.G.posture, move:FG.G.move, recruits:FG.G.recruits.length};
    // grid check: every soldier on his file slot
    const F=FG.F; let worst=0; const g=F.path.last, dv=[Math.sin(g.h),-Math.cos(g.h)], nv=[Math.cos(g.h),Math.sin(g.h)];
    const pts=[]; F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(s) pts.push([r,q,(s.x-g.x)*dv[0]+(s.y-g.y)*dv[1],(s.x-g.x)*nv[0]+(s.y-g.y)*nv[1]]); }));
    const A0=pts[0][2]+pts[0][0], L0=pts[0][3]-pts[0][1];
    for(const [r,q,a,l] of pts) worst=Math.max(worst,Math.abs(a-(A0-r)),Math.abs(l-(L0+q)));
    o.worst=+worst.toFixed(3); o.faces=[...new Set(FG.state().soldiers.map(s=>s[2]))];
    FG.sim(300); return o; });
  ck(e.phase==="formed" && e.W===4 && e.ranks===4 && e.n===16 && e.worst<0.02 && e.faces.length===1 && e.posture==="attention" && e.move==="halt",
     `${mode}: formed 4x4 at attention, halted, grid error ${e.worst}, all facing ${e.faces} (took ${(e.ms/1000).toFixed(1)} s)`);
  ck(Math.abs(e.sgt.out-2)<0.05 && Math.abs(e.sgt.depthOff)<0.05, `${mode}: drill sergeant on post, LEFT flank centred ${JSON.stringify(e.sgt)}`);
  ck(mode!=="snake" || e.recruits===3, `${mode}: recruits appear only after forming (${e.recruits})`);
  if(mode==="snake") await shot('fallin-3-formed');
  // game proceeds as before
  const g=await p.evaluate(()=>{ FG.cmd("forward march"); FG.sim(3000); const h0=FG.state().heading; FG.cmd("column left march"); FG.sim(5000);
     return {move:FG.G.move, heading:FG.state().heading, over:FG.G.over, h0}; });
  ck(g.move==="forward" && g.heading===270 && !g.over, `${mode}: after forming, Forward MARCH and Column left work (heading ${g.h0}->${g.heading})`);
  // a second "fall in" once formed keeps the old behaviour (re-form in column, no scatter)
  const h=await p.evaluate(()=>{ FG.cmd("fall in"); FG.sim(1500); return FG.phase(); });
  ck(h==="formed", `${mode}: Fall in after forming re-forms without scattering (${h})`);
 }
 // walls count again once formed (snake)
 const w=await p.evaluate(()=>{ window.__noWalls=false; FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none";
   FG.cmd("fall in"); let t=0; while(FG.phase()!=="formed" && t<30000){ FG.sim(100); t+=100; }
   FG.cmd("forward march"); for(let i=0;i<400 && !FG.G.over;i++) FG.sim(100); return {over:FG.G.over, why:document.getElementById('ovText').textContent}; });
 ck(w.over && /wall/.test(w.why), "snake: once formed, marching into the wall breaks the formation as before ("+w.why+")");
 // restart button -> scattered again
 const rs=await p.evaluate(()=>{ document.getElementById('ovBtn').click(); return FG.phase(); });
 ck(rs==="scatter", "Restart after Formation broke: soldiers scattered again, waiting for Fall in ("+rs+")");
 // start screen text
 await p.evaluate(()=>{ document.getElementById('btnQuit').click(); });
 const txt=await p.evaluate(()=>document.getElementById('start').innerText);
 ck(/say "Fall in\."/i.test(txt) && txt.indexOf('Fall in')<txt.indexOf('Forward'), 'start screen tells you to say "Fall in" first');
 await p.evaluate(()=>window.scrollTo(0,0)); await shot('fallin-start-screen');
 console.log("fails",fails,"errors",JSON.stringify(errs)); await b.close(); process.exit(fails||errs.length?1:0);
})();
