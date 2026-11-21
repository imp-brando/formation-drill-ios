// Drill sergeant: centred on the formation's LEFT side (2 steps out, middle of the depth), at all times,
// never on top of a soldier, and the default formation is 4 x 4.
const puppeteer=require('puppeteer-core'), P=require('path');
const CMDS={rflank:"right flank march",lflank:"left flank march",rear:"rear march",colL:"column left march",colR:"column right march",counter:"counter column march",halt:"platoon halt",fwd:"forward march",colHL:"column half left march",mark:"mark time march",lface:"left face",about:"about face"};
const SC=[
 {name:"start",seq:[],shot:true},
 {name:"column-left",seq:["colL"],shot:true},
 {name:"column-right",seq:["colR"]},
 {name:"column-half-left",seq:["colHL"]},
 {name:"right-flank",seq:["rflank"],shot:true},
 {name:"left-flank",seq:["lflank"]},
 {name:"rear-march",seq:["rear"],shot:true},
 {name:"rflank-rear-lflank",seq:["rflank","rear","lflank"]},
 {name:"counter-column",seq:["counter"],shot:true,mid:true},
 {name:"mark-time",seq:["mark"]},
 {name:"recruits",seq:["rflank"],recruits:5,shot:true},
 {name:"recruits-column",seq:[],recruits:7},
 {name:"halt-about-face",seq:["halt","about"]},
];
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const check=(ok,msg)=>{ console.log((ok?"PASS ":"FAIL ")+msg); if(!ok) fails++; };
 for(const mode of ["snake","drill"]){
  const st=await p.evaluate(m=>{ window.__noWalls=true; FG.startHeadless(m); FG.sim(100); return {n:FG.state().soldiers.length, W:FG.F.W, ranks:FG.F.ranks.length, sgt:FG.sgt()}; },mode);
  check(st.n===16&&st.W===4&&st.ranks===4, `${mode}: default formation 4x4 (${st.ranks} ranks x ${st.W} files, ${st.n} soldiers)`);
  check(Math.abs(st.sgt.out-2)<0.05 && Math.abs(st.sgt.depthOff)<0.05, `${mode}: sergeant on post at start ${JSON.stringify(st.sgt)}`);
 }
 for(const sc of SC){
  const r=await p.evaluate((sc,CMDS)=>{
   const say=c=>FG.cmd(CMDS[c]);
   window.__noWalls=true; FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none";
   let minD=99, maxOut=-99; const sample=ms=>{ for(let t=0;t<ms;t+=96){ FG.sim(96); const s=FG.sgt(); minD=Math.min(minD,s.minDist); } };
   sample(600);
   if(sc.recruits && !sc.seq.length){ for(let i=0;i<sc.recruits;i++){ FG.addRecruit(); sample(200); } }
   if(sc.seq[0]!=="halt"){ say("fwd"); sample(1200); }
   for(const c of sc.seq){ say(c); sample(c==="counter"?(sc.mid?2600:6000):c==="halt"?1500:2600); }
   const mid=FG.sgt();
   if(sc.recruits && sc.seq.length){ say("halt"); sample(2000); for(let i=0;i<sc.recruits;i++){ FG.addRecruit(); sample(200); } say("fwd"); sample(800); }
   if(sc.mid) return {mid, minD, over:FG.G.over};
   sample(6000);                                     // settle: he must be back on post
   return {end:FG.sgt(), minD, over:FG.G.over, n:FG.state().soldiers.length};
  },sc,CMDS);
  const e=r.end;
  if(sc.mid) check(r.minD>=0.75 && !r.over, `${sc.name} (mid-maneuver): never on a soldier, minDist ${r.minD.toFixed(2)}; sgt ${JSON.stringify(r.mid)}`);
  else check(Math.abs(e.out-2)<0.25 && Math.abs(e.depthOff)<0.25 && r.minD>=0.75 && !r.over,
    `${sc.name}: on post (out ${e.out}, depth offset ${e.depthOff}, heading ${e.h}) minDist through maneuver ${r.minD.toFixed(2)}${r.n?", soldiers "+r.n:""}`);
  if(sc.shot){
   await p.evaluate(()=>FG.sim(16));
   await p.screenshot({path:P.resolve(__dirname,'../shots/sgt-'+sc.name+'.png')});
  }
 }
 // snake start screenshot (full field)
 await p.evaluate(()=>{ window.__noWalls=false; FG.startHeadless('snake'); FG.sim(200); });
 await p.screenshot({path:P.resolve(__dirname,'../shots/sgt-snake-start.png')});
 // snake: sergeant near the wall never breaks the formation; soldiers still do
 const w=await p.evaluate(()=>{ window.__noWalls=false; FG.startHeadless('snake'); FG.setRecOn(true); FG.settings.sens="none"; FG.G.recruits=[];
   FG.sim(500); FG.cmd("forward march"); FG.sim(1500); FG.cmd("right flank march"); let first=null;
   for(let i=0;i<300&&!FG.G.over;i++){ FG.sim(100); const s=FG.sgt(); if(s.x>=FG.F && 0) first=s; }
   return {over:FG.G.over, why:document.getElementById('ovText').textContent, sgt:FG.sgt()}; });
 check(w.over && /wall/.test(w.why), `snake: soldiers (not the sergeant) hit the wall: "${w.why}" sgt x=${w.sgt.x}`);
 console.log("fails",fails,"errors",JSON.stringify(errs)); await b.close(); process.exit(fails?1:0);
})();
