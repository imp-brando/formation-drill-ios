// How recruits fill the formation and how it covers down (user rules, t76u/t77u):
// - facing the front (not flanked) never more than 4 files; joins go to the back of the farthest-right file
//   (incomplete rear rank fills from the right file inward); nobody ahead of the front rank or off the files;
// - flanks / facings keep the formation: a clean formation keeps every soldier's position;
// - after every change of direction a broken file or rank covers down (nothing else moves).
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:3}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 await p.evaluate(()=>{
  window.T={
   fresh(mode){ FG.startHeadless(mode||'drill',true); FG.setRecOn(true); FG.settings.sens="none"; FG.cmd("fall in"); FG.formNow(); FG.sim(1500); },
   go(t,ms){ const id=FG.cmd(t); FG.sim(ms||3000); return id; },
   grid(){ return FG.F.ranks.map(rk=>rk.sol.map(s=>s?'o':'.').join('')).join('|'); },
   /** structure + geometry check in the formation's own frame (u forward, v to the right) */
   check(){
    const F=FG.F, W=F.W, D=F.ranks.length, why=[];
    const h=F.path.posAt(F.ranks[0].s).h, d=dirV(h), n=nrmV(h);
    if(!F.inLine && W>4) why.push(`${W} files facing the front`);
    for(let q=0;q<W;q++){ const fr=[]; F.ranks.forEach((rk,r)=>{ if(rk.sol[q]) fr.push(r); });
      if(!fr.length){ why.push(`empty file ${q}`); continue; }
      if(fr[fr.length-1]-fr[0]!==fr.length-1) why.push(`gap in file ${q}`);
      const outsideAtRear=(q===0||q===W-1) && fr[fr.length-1]===D-1;
      if(fr[0]!==0 && !outsideAtRear) why.push(`file ${q} starts behind the front rank`); }
    if(!F.ranks[0].sol.some(Boolean)) why.push('empty front rank');
    // geometry (settled, every file past its pivot): nobody ahead of the front rank, everybody on a file lane
    if(!F.ranks.every(rk=>rk.fs.every(onNewestSeg))) return why;
    const pos=[]; F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(s) pos.push({r,q,u:s.x*d[0]+s.y*d[1], v:s.x*n[0]+s.y*n[1]}); }));
    const front=pos.filter(o=>o.r===0), uF=Math.max(...front.map(o=>o.u));
    if(pos.some(o=>o.u>uF+0.3)) why.push('a man ahead of the front rank');
    const lanes=[...new Set(pos.map(o=>Math.round(o.v*4)/4))];
    for(let q=0;q<W;q++){ const vs=pos.filter(o=>o.q===q).map(o=>o.v); if(vs.length && Math.max(...vs)-Math.min(...vs)>0.35) why.push(`file ${q} not straight`); }
    return why;
   },
   pos(){ const o={}; FG.F.ranks.forEach(rk=>rk.sol.forEach(s=>{ if(s) o[s.id]=[s.x,s.y]; })); return o; },
   moved(a,b2){ let m=0; for(const id in a){ const y=b2[id]; m=Math.max(m, y? Math.hypot(a[id][0]-y[0],a[id][1]-y[1]) : 99); } return m; },
   lastJoin(){ const F=FG.F; let best=null; F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(s && (!best||s.id>best.s.id)) best={s,r,q}; })); return best; },
  };
 });
 const settle=()=>p.evaluate(()=>FG.sim(2500));

 // 1) joins in every facing: never > 4 files facing front, always back-right, no strays
 for(const face of [null,"right face","left face","about face"]){
  const r=await p.evaluate(face=>{
   T.fresh(); if(face) T.go(face);
   const inLine=FG.F.inLine, out={bad:[], w:[], slots:[]};
   for(let k=1;k<=12;k++){
     const D0=FG.F.ranks.length, W0=FG.F.W;
     // expected slot: back of the rightmost file that doesn't reach the rear rank, else a new rear rank on the right
     let exp=null; for(let q=W0-1;q>=0 && !exp;q--){ let last=-1; FG.F.ranks.forEach((rk,r)=>{ if(rk.sol[q]) last=r; }); if(last<D0-1) exp=[last+1,q]; }
     if(!exp) exp=[D0, W0-1];
     FG.addRecruit(); FG.sim(400);
     const j=T.lastJoin(); out.slots.push(`${j.r},${j.q}`);
     if(j.r!==exp[0]||j.q!==exp[1]) out.bad.push(`join ${k}: at rank ${j.r} file ${j.q}, expected ${exp}`);
     out.w.push(FG.F.W);
     const why=T.check(); if(why.length) out.bad.push(`join ${k}: ${why.join(', ')} ${T.grid()}`);
   }
   out.inLine=inLine; out.grid=T.grid(); return out; },face);
  const name=face||"facing the front";
  ck(!r.bad.length, `${name}: 12 joins each at the back of the farthest-right file, no strays: ${r.grid}${r.bad.length?' · '+r.bad.slice(0,3).join(' · '):''}`);
  if(!face || face==="about face") ck(r.w.every(w=>w<=4), `${name}: never more than 4 files (${[...new Set(r.w)].join(',')})`);
 }

 // 2) flanks / facings keep the formation (t77u): clean formation → nobody moves, only turns
 for(const [pre,label] of [[0,"clean 4x4"],[2,"4x4 + 2 in the rear rank"]]){
  for(const face of ["right face","left face","about face"]){
   const r=await p.evaluate(([pre,face])=>{ T.fresh(); for(let i=0;i<pre;i++) FG.addRecruit(); FG.sim(2500);
     const a=T.pos(), g0=T.grid(), h0=FG.state().heading; T.go(face); const b2=T.pos();
     return {moved:T.moved(a,b2), g0, g1:T.grid(), turned:(FG.state().heading-h0+360)%360, why:T.check()}; },[pre,face]);
   const keep = !(pre && face==="about face");          // about face puts the incomplete rank in front: it covers down
   if(keep) ck(r.moved<0.05 && r.turned, `${label}, ${face}: every soldier keeps his position, formation turned ${r.turned}° (${r.g0} → ${r.g1}, moved ${r.moved.toFixed(3)})`);
   else ck(!r.why.length && r.moved>0.5, `${label}, ${face}: the incomplete rank that ended up in front covers down to the back (${r.g0} → ${r.g1})`);
  }
 }

 // 3) the user's screenshots, recreated: before the fix these left strays
 const u=await p.evaluate(()=>{ const o={};
   T.fresh(); FG.addRecruit(); T.go("about face"); FG.addRecruit(); FG.sim(2500); o.a={g:T.grid(), why:T.check()};       // man ahead + man behind the right file
   T.fresh(); T.go("right face"); FG.addRecruit(); FG.addRecruit(); FG.sim(2500); o.b={g:T.grid(), why:T.check(), W:FG.F.W};   // 5th file beside the front
   T.go("left face"); o.c={g:T.grid(), why:T.check(), W:FG.F.W, inLine:FG.F.inLine};                                         // extras off the ends facing front
   return o; });
 ck(!u.a.why.length && u.a.g.split('|')[0]==='oooo', `about face after a join, then another join: nobody ahead of the front rank (${u.a.g})`);
 ck(!u.b.why.length && u.b.W===4, `flanked, two joins: they fall in at the back of the right file, no 5th file (${u.b.g})`);
 ck(!u.c.why.length && u.c.W===4 && !u.c.inLine, `facing the front again: 4 files, extras at the back right (${u.c.g})`);

 // 4) auto cover down after every direction command, marching and at the halt, with joins in between
 const seq=["right face","left face","about face","forward march","column right march","column left march","right flank march","left flank march","column half right march","rear march","platoon halt","right face","about face","left face"];
 const s=await p.evaluate(seq=>{ const bad=[]; T.fresh(); let k=0;
   for(const c of seq){ FG.addRecruit(); if(k++%2) FG.addRecruit(); const id=T.go(c, c==="platoon halt"?2500:4000);
     const why=T.check(); if(why.length) bad.push(`${c} (${id}): ${why.join(', ')} ${T.grid()}`);
     if(!FG.F.inLine && FG.F.W>4) bad.push(`${c}: ${FG.F.W} files facing the front`); }
   return {bad, g:T.grid(), n:FG.state().soldiers.length, over:FG.G.over}; },seq);
 ck(!s.bad.length && !s.over, `${seq.length} direction commands with joins in between: covered down every time, ${s.n} soldiers (${s.g})${s.bad.length?' · '+s.bad.slice(0,3).join(' · '):''}`);

 // 5) ragged Fall in stays ragged until Cover/Recover (cover down fixes structure only)
 const rg=await p.evaluate(()=>{ T.fresh(); const a=FG.cover().sloppy; FG.addRecruit(); T.go("right face"); T.go("left face"); return {a, b:FG.cover().sloppy}; });
 ck(rg.a && rg.b, 'ragged Fall in is still ragged after joins and facings');
 // 6) the DS is still on the left flank after cover down
 const ds=await p.evaluate(()=>{ T.fresh(); for(let i=0;i<6;i++) FG.addRecruit(); T.go("about face"); FG.sim(6000); const S=FG.sgt(); return S && {out:S.out, toT:S.toTarget}; });
 ck(ds && ds.toT<0.6, `drill sergeant back on post on the left flank after cover down (${ds && ds.toT})`);

 // screenshots of the user's cases, fixed (Snake field, straightened with Cover / Recover, cropped round the formation)
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 const straight=()=>p.evaluate(()=>{ T.go("cover"); T.go("recover"); });
 await p.evaluate(()=>{ T.fresh('snake'); }); await straight();
 await p.evaluate(()=>{ FG.addRecruit(); T.go("about face"); FG.addRecruit(); FG.sim(2500); }); await shot('fill-1-about-face-then-join');
 await p.evaluate(()=>{ T.fresh('snake'); }); await straight(); await p.evaluate(()=>{ FG.addRecruit(); FG.addRecruit(); FG.sim(2500); }); await shot('fill-2-two-joins-back-right');
 await p.evaluate(()=>{ T.go("right face"); }); await shot('fill-3-right-face-keeps-formation');
 await p.evaluate(()=>{ T.fresh('snake'); }); await straight(); await p.evaluate(()=>{ T.go("right face"); FG.addRecruit(); FG.addRecruit(); FG.sim(2500); }); await shot('fill-4-flanked-joins-back-right');
 await p.evaluate(()=>{ T.go("left face"); }); await shot('fill-5-face-front-4-files');
 ck(!errs.length, 'no page errors '+errs.join(' | '));
 console.log(fails?`${fails} FAILED`:'ALL PASS'); await b.close(); process.exit(fails?1:0);
})();
