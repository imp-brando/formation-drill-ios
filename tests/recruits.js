// Recruits after flanks / rear march / column turns / counter column: they must fall in at the squads' tail,
// keep 4 squads (4 files in column, 4 ranks in line), sit exactly on the grid, and cause no false break.
const puppeteer=require('puppeteer-core'), P=require('path');
const CMDS={rflank:"right flank march",lflank:"left flank march",rear:"rear march",colL:"column left march",colR:"column right march",counter:"counter column march",halt:"platoon halt",fwd:"forward march"};
const SEQS=[["rflank"],["lflank"],["rflank","lflank"],["lflank","rflank"],["rflank","rflank"],["lflank","lflank","lflank"],["rflank","rear"],["lflank","colL"],["rflank","colR"],["colR","rflank"],["rear"],["colL"],["counter"],["rflank","rear","lflank"]];
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0;
 for(const seq of SEQS) for(const n of [1,3,5,8]){
  const r=await p.evaluate((seq,n,CMDS)=>{
   const say=c=>FG.cmd(CMDS[c]);
   window.__noWalls=true; FG.startHeadless('snake'); FG.setRecOn(true); FG.settings.sens="none"; FG.G.recruits=[];
   FG.sim(800); say("fwd"); FG.sim(1000);
   for(const c of seq){ say(c); FG.sim(c==="counter"?5200:2600); }
   say("halt"); FG.sim(2000);
   const ids0=new Set(FG.F.ranks.flatMap(rk=>rk.sol.filter(Boolean).map(s=>s.id)));
   for(let i=0;i<n;i++){ FG.addRecruit(); FG.sim(150); }
   const inLine=FG.F.inLine;
   FG.sim(600); const atHalt=grid(); atHalt.recruitErr=recruitErr();
   // each new soldier: exactly one step from the squad-mate he fell in beside/behind
   function recruitErr(){ const F=FG.F; let w=0, missing=0;
     F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(!s||ids0.has(s.id)) return;
       const nb = F.inLine ? (rk.sol[q-1]||rk.sol[q+1]) : (F.ranks[r-1]&&F.ranks[r-1].sol[q]);
       if(!nb){ missing++; return; }
       w=Math.max(w, Math.abs(Math.hypot(s.x-nb.x,s.y-nb.y)-1)); }));
     return {worst:+w.toFixed(3), missing}; }
   say("fwd"); FG.sim(1500); say("colL"); FG.sim(11000);   // a 6-file line needs ~8 s for the outer file to catch up
   if(FG.G.over) return {over:document.getElementById('ovText').textContent};
   const after=grid();
   function grid(){
   const F=FG.F;
   const g=F.path.last, dv=[Math.sin(g.h),-Math.cos(g.h)], nv=[Math.cos(g.h),Math.sin(g.h)];
   let worst=0, count=0; const ref={x:g.x,y:g.y};
   const along=[], lat=[];
   F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(!s) return; count++;
     const dx=s.x-ref.x, dy=s.y-ref.y; along.push([r,q,dx*dv[0]+dy*dv[1]]); lat.push([r,q,dx*nv[0]+dy*nv[1]]); }));
   // expected: along = A0 - r*rankDist, lat = L0 + q*interval
   const A0=along.find(a=>a[0]===0)[2]+0, L0=lat[0][2]-lat[0][1]*F.interval;
   for(const [r,q,a] of along) worst=Math.max(worst, Math.abs(a-(A0-r*F.rankDist)));
   for(const [r,q,l] of lat) worst=Math.max(worst, Math.abs(l-(L0+q*F.interval)));
   // squads: in column 4 files; in line 4 ranks
   const shape={W:F.W, D:F.ranks.length, inLine:F.inLine};
   const squadsOK = F.inLine ? F.ranks.length===4 : F.W===4;
   // at most one partly filled file (in line) or rank (in column)
   const partial = F.inLine ? [...Array(F.W).keys()].filter(q=>F.ranks.some(rk=>!rk.sol[q])).length : F.ranks.filter(rk=>rk.sol.some(x=>!x)).length;
   const straight=F.ranks.every(rk=>rk.fs.every(f=>f.seg===F.path.last));
   return {count, worst:+worst.toFixed(3), shape, squadsOK, partial, straight};
   }
   return {atHalt, after, inLineAtAdd:inLine, pending:FG.G.pendingRecruits||0};
  },seq,n,CMDS);
  const g1=r.atHalt||{}, g2=r.after||{};
  // halted mid-turn = a legitimate staircase; the grid check only applies once everyone is on the new heading
  const ok = !r.over && (g1.recruitErr.worst<0.06 || !g1.straight) && g1.recruitErr.missing===0 && (!g1.straight || (g1.count===16+n && g1.squadsOK && g1.partial<=1)) && g2.straight && g2.count===16+n && g2.worst<0.06 && g2.squadsOK && g2.partial<=1 && !r.pending;
  if(!ok) fails++;
  console.log((ok?'PASS ':'FAIL ')+(seq.join('+')+' +'+n).padEnd(24), JSON.stringify(r));
 }
 // screenshots: right flank then 3 recruits, halted and after marching on
 await p.evaluate(()=>{ window.__noWalls=false; FG.startHeadless('snake'); FG.setRecOn(true); FG.settings.sens="none"; FG.G.recruits=[]; FG.sim(800); FG.cmd("forward march"); FG.sim(1000); FG.cmd("right flank march"); FG.sim(2600); FG.cmd("platoon halt"); FG.sim(2000); for(let i=0;i<3;i++){ FG.addRecruit(); FG.sim(150);} FG.sim(600); });
 await p.screenshot({path:P.resolve(__dirname,'../shots/recruits-after-rflank.png')});
 await p.evaluate(()=>{ FG.cmd("forward march"); FG.sim(1500); FG.cmd("left flank march"); FG.sim(2600); });
 await p.screenshot({path:P.resolve(__dirname,'../shots/recruits-after-rflank-then-lflank.png')});
 console.log('fails',fails,'errors',errs); await b.close(); process.exit(fails||errs.length?1:0);
})();
