// "At close interval, MARCH": right hand on hip, elbow touching the next man (zero gap), files close on the right file.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 const zoom=async n=>{ const c=await p.evaluate(()=>{ const r=cv.getBoundingClientRect(), f=r.width/cv.width, sol=FG.state().soldiers;
   const xs=sol.map(s=>s[0]), ys=sol.map(s=>s[1]);
   const x0=Math.min(...xs)-1.2, x1=Math.max(...xs)+1.2, y0=Math.min(...ys)-1.2, y1=Math.max(...ys)+1.2, X=x=>r.left+(view.ox+x*view.scale)*f, Y=y=>r.top+(view.oy+y*view.scale)*f;
   return {x:X(x0), y:Y(y0), width:X(x1)-X(x0), height:Y(y1)-Y(y0)}; });
   const full=P.resolve(__dirname,'../shots/'+n.replace('-zoom','')+'.png'), out=P.resolve(__dirname,'../shots/'+n+'.png');
   require('child_process').execFileSync('/usr/bin/python3',['-c',`from PIL import Image; im=Image.open('${full}'); c=im.crop((${Math.round(c.x*2)},${Math.round(c.y*2)},${Math.round((c.x+c.width)*2)},${Math.round((c.y+c.height)*2)})); c.resize((c.width*3,c.height*3),Image.LANCZOS).save('${out}')`]); };

 // ---- recognition
 const yes=["at close interval march","At close intervals, MARCH!","close interval march","at clothes interval march","a close interval march","at close in-trouble march","closin' interval march","platoon, at close interval, march","at close interval harch"];
 const no=["close the window","at close range","that was a close call","interval training is hard","what is the interval","we closed early","close enough","at close interval"];
 const pr=await p.evaluate((y,n)=>({y:y.map(t=>[t,FG.parse(t)]), n:n.map(t=>[t,FG.parse(t)]),
   other:[["close march",FG.parse("close march")],["close ranks march",FG.parse("close ranks march")],["extend march",FG.parse("extend march")],["normal interval march",FG.parse("normal interval march")]],
   ny:["normal interval march","Normal intervals, MARCH!","at normal interval march","at normal intervals march","normal in trouble march","platoon, normal interval, march","normal interval harch"].map(t=>[t,FG.parse(t)]),
   nn:["back to normal","that's not normal","normal interval training","what is a normal interval","normal interval"].map(t=>[t,FG.parse(t)])}),yes,no);
 ck(pr.y.every(x=>x[1]==="closeint"), "At close interval sound-alikes: "+pr.y.map(x=>x[0]+"="+x[1]).join(", "));
 ck(pr.n.every(x=>x[1]!=="closeint"), "chatter rejected: "+pr.n.map(x=>x[0]+"="+x[1]).join(", "));
 ck(pr.other.map(x=>x[1]).join()==="close,closeranks,extend,normint", "neighbouring commands unchanged: "+pr.other.map(x=>x[0]+"="+x[1]).join(", "));

 ck(pr.ny.every(x=>x[1]==="normint"), "Normal interval sound-alikes: "+pr.ny.map(x=>x[0]+"="+x[1]).join(", "));
 ck(pr.nn.every(x=>x[1]!=="normint"), "Normal interval chatter rejected: "+pr.nn.map(x=>x[0]+"="+x[1]).join(", "));
 // ---- errors: before Fall in, while marching, while arms already out
 const e=await p.evaluate(()=>{
  const out={};
  FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none";
  let b0=FG.bang().n; FG.cmd("at close interval march"); FG.sim(1500); out.beforeFall = FG.bang().n>b0 && !FG.cover().cover && FG.phase()==="scatter";
  FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300);
  FG.G.recruits.length=0; FG.cmd("forward march"); FG.sim(3000);
  b0=FG.bang().n; const iv0=FG.cover().interval; FG.cmd("at close interval march"); FG.sim(1500);
  out.marching = FG.bang().n===b0+1 && !FG.cover().cover && FG.cover().interval===iv0 && FG.G.move==="forward";
  FG.cmd("platoon halt"); FG.sim(2500);
  FG.cmd("cover"); FG.sim(2500);
  b0=FG.bang().n; FG.cmd("at close interval march"); FG.sim(1500);
  out.armsOut = FG.bang().n===b0+1 && FG.cover().kind==="cover";
  FG.cmd("recover"); FG.sim(800);
  return out; });
 ck(e.beforeFall, "before Fall in: '!' and nothing else");
 ck(e.marching, "while marching: '!' and nothing else");
 ck(e.armsOut, "while arms are out at COVER: '!' and nothing else");

 // ---- execute at the halt (ragged first) facing north
 const fn=async()=>p.evaluate(()=>{
  const k=1.4, A=FG.arms(), sol=FG.state().soldiers, h=FG.F.path.posAt(FG.F.ranks[0].s).h, d=[Math.sin(h),-Math.cos(h)], n=[Math.cos(h),Math.sin(h)];
  const rt=s=>s.x*n[0]+s.y*n[1], fw=s=>s.x*d[0]+s.y*d[1];
  const rts=[...new Set(A.map(a=>Math.round(rt(a)*1000)/1000))].sort((a,b)=>a-b), fws=[...new Set(A.map(a=>Math.round(fw(a)*1000)/1000))].sort((a,b)=>a-b);
  const maxR=Math.max(...A.map(rt));
  const rightFile=A.filter(a=>rt(a)>maxR-0.2), others=A.filter(a=>rt(a)<=maxR-0.2);
  const v=FG.visual();
  return {kind:FG.cover().kind, hold:FG.cover().hold, iv:FG.cover().interval, rd:FG.cover().rankDist, arms:A.map(a=>a.arm),
    rts, fws, sideOK:A.every(a=>a.side>0 && a.handSide>0), maxHandDist:Math.max(...A.map(a=>a.handDist)),
    gapsOthers:others.map(a=>a.gap), touchOK:others.every(a=>a.touchSide>0.5 && Math.abs(a.touchAhead)<0.05),
    gapsRight:rightFile.map(a=>a.gap), nRight:rightFile.length,
    maxOff:Math.max(...v.map(s=>Math.hypot(s.vx-s.x,s.vy-s.y)+Math.abs(s.df))), heading:FG.state().heading, sloppy:FG.cover().sloppy}; });
 const pre=await p.evaluate(()=>{ const h=FG.F.path.posAt(FG.F.ranks[0].s).h, n=[Math.cos(h),Math.sin(h)], A=FG.state().soldiers;
   const rt=s=>s[0]*n[0]+s[1]*n[1]; const r=A.map(rt); return {maxR:Math.max(...r), minR:Math.min(...r), ragged:FG.cover().sloppy}; });
 // make it ragged again to prove the shuffle also fixes raggedness
 await p.evaluate(()=>{ FG.G.sloppy=true; for(const s of FG.G.soldiers||[]){} });
 const mid=await p.evaluate(()=>{ FG.cmd("at close interval march"); for(let i=0;i<60 && !FG.cover().cover;i++) FG.sim(16); FG.sim(500); return {cover:FG.cover().cover, kind:FG.cover().kind, hold:FG.cover().hold, shuffling:FG.G.move==="halt"}; });
 ck(mid.cover && mid.kind==="hip" && !mid.hold, "At close interval (halt): hands go to hips, soldiers shuffle into place");
 await p.evaluate(()=>FG.sim(1600));
 const r1=await fn();
 const post=await p.evaluate(()=>{ const h=FG.F.path.posAt(FG.F.ranks[0].s).h, n=[Math.cos(h),Math.sin(h)], A=FG.state().soldiers; const r=A.map(s=>s[0]*n[0]+s[1]*n[1]); return {maxR:Math.max(...r), minR:Math.min(...r)}; });
 ck(r1.hold && r1.maxOff===0 && !r1.sloppy, `after ~1.5 s exact alignment (max visual offset ${r1.maxOff})`);
 ck(r1.arms.every(a=>a==="hip") && r1.arms.length===16, "all 16 soldiers: right hand on hip");
 ck(r1.sideOK && r1.maxHandDist<0.25, "elbow and hand on the RIGHT side; hand at the hip (within "+r1.maxHandDist.toFixed(2)+" sprite units of centre)");
 ck(Math.abs(r1.iv-0.75)<1e-9 && r1.rts.length===4 && r1.rts.every((x,i)=>!i||Math.abs(x-r1.rts[i-1]-0.75)<0.002), `interval tightened 1 → ${r1.iv} step: files at ${r1.rts.join(", ")}`);
 ck(Math.abs(r1.rd-1)<1e-9 && r1.fws.every((x,i)=>!i||Math.abs(x-r1.fws[i-1]-1)<0.002), "distance between ranks unchanged (1 step): "+r1.fws.join(", "));
 ck(Math.abs(post.maxR-pre.maxR)<0.002 && post.minR>pre.minR+0.7, `right file stood fast (${pre.maxR.toFixed(3)} → ${post.maxR.toFixed(3)}), left file closed in (${pre.minR.toFixed(3)} → ${post.minR.toFixed(3)})`);
 ck(r1.gapsOthers.length===12 && r1.gapsOthers.every(g=>Math.abs(g)<0.002) && r1.touchOK, "elbow → left side of the man to his right: gap "+r1.gapsOthers.map(g=>g.toFixed(4)).join(",")+" (zero: touching, no overlap)");
 ck(r1.nRight===4 && r1.gapsRight.every(g=>g>0.3), "right file: hand on hip, elbow touches nothing (clearance "+r1.gapsRight.map(g=>g.toFixed(2)).join(",")+")");
 await shot('closeint-1-north'); await zoom('closeint-1-north-zoom');
 // other commands while hands are on hips -> "!"
 const oth=await p.evaluate(()=>{ const res=[]; for(const t of ["forward march","right face","at close interval march","cover","dress right dress"]){ const b0=FG.bang().n, st=JSON.stringify(FG.state()); FG.cmd(t); FG.sim(1500); res.push([t, FG.bang().n===b0+1 && JSON.stringify(FG.state())===st && FG.cover().kind==="hip"]); } return res; });
 ck(oth.every(x=>x[1]), "any other command with hands on hips: '!' and nothing else ("+oth.map(x=>x[0]+":"+x[1]).join(", ")+")");

 // ---- recover: arms drop, close interval stays
 const rc=await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1500); const A=FG.arms(); return {cover:FG.cover().cover, arms:A.filter(a=>a.arm).length, iv:FG.cover().interval, posture:FG.G.posture}; });
 ck(!rc.cover && rc.arms===0 && rc.iv===0.75 && rc.posture==="attention", `RECOVER: arms down, attention, still at close interval (${rc.iv})`);

 // ---- 4 facings: arms and zero gap relative to facing
 const faces=[];
 for(const t of ["right face","right face","right face","right face"]){
   const r=await p.evaluate(t=>{ FG.cmd(t); FG.sim(2500); FG.cmd("at close interval march"); FG.sim(2600); return true; },t);
   const a=await fn(); faces.push(a);
   if(faces.length===1){ await shot('closeint-2-east'); await zoom('closeint-2-east-zoom'); }
   await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1500); });
 }
 const hd=await p.evaluate(()=>FG.state().soldiers.map(s=>s[2]));
 for(const [i,a] of faces.entries()){
   ck(a.arms.every(x=>x==="hip") && a.sideOK && a.gapsOthers.length===12 && a.gapsOthers.every(g=>Math.abs(g)<0.002) && a.touchOK && a.nRight===4 && a.gapsRight.every(g=>g>0.3) && a.rts.every((x,j)=>!j||Math.abs(x-a.rts[j-1]-0.75)<0.002),
     `facing ${[90,180,270,0][i]}°: hands on right hips, 12 elbows touching (max |gap| ${Math.max(...a.gapsOthers.map(Math.abs)).toFixed(4)}), right file free, interval 0.75`);
 }

 // ---- maneuvers at close interval don't false-break
 const man=await p.evaluate(()=>{
  window.__noWalls=true;   // long route: walls off so only a real self-collision counts
  const log=[]; let over=false; const run=(t,ms)=>{ FG.cmd(t); for(let i=0;i<ms/250;i++){ FG.sim(250); over=over||FG.G.over; } log.push(t+":"+(FG.G.over?"BROKE("+document.getElementById("ovText").textContent+")":"ok")); };
  FG.G.recruits.length=0;
  run("forward march",2500); run("column right march",4000); run("column left march",4000); run("right flank march",3000); run("left flank march",3000);
  run("rear march",3000); run("rear march",3000); run("column half right march",3000); run("column half left march",3000);
  run("counter column march",9000); run("platoon halt",2500);
  return {over, log, iv:FG.cover().interval, rd:FG.cover().rankDist, W:FG.F.W}; });
 ck(!man.over, "maneuvers at close interval, no formation broke: "+man.log.join(", "));
 // marching shot at close interval
 await p.evaluate(()=>{ FG.cmd("forward march"); FG.sim(2000); });
 await shot('closeint-3-march'); await zoom('closeint-3-march-zoom');
 const mv=await p.evaluate(()=>{ const sol=FG.state().soldiers, h=FG.F.path.posAt(FG.F.ranks[0].s).h, n=[Math.cos(h),Math.sin(h)];
   const r=[...new Set(sol.map(s=>Math.round((s[0]*n[0]+s[1]*n[1])*100)/100))].sort((a,b)=>a-b); FG.cmd("platoon halt"); FG.sim(2500); return {r, over:FG.G.over}; });
 ck(mv.r.length===4 && mv.r.every((x,i)=>!i||Math.abs(x-mv.r[i-1]-0.75)<0.02) && !mv.over, "marching after counter column: still at close interval (files at "+mv.r.join(", ")+")");

 // ---- recruit fill at close interval
 const rec=await p.evaluate(()=>{ const n0=FG.state().soldiers.length; FG.addRecruit(); FG.addRecruit(); FG.sim(2500); FG.cmd("forward march"); let over=false; for(let i=0;i<12;i++){ FG.sim(250); over=over||FG.G.over; } FG.cmd("platoon halt"); FG.sim(2500);
   const sol=FG.state().soldiers; let md=9; for(let i=0;i<sol.length;i++) for(let j=i+1;j<sol.length;j++) md=Math.min(md,Math.hypot(sol[i][0]-sol[j][0],sol[i][1]-sol[j][1]));
   return {n0, n:sol.length, over, md, iv:FG.cover().interval}; });
 ck(rec.n===rec.n0+2 && !rec.over && rec.md>0.7, `recruit fill at close interval: ${rec.n0} → ${rec.n}, nearest pair ${rec.md.toFixed(2)} step, no break`);

 await p.evaluate(()=>{ window.__noWalls=false; });

 // ======== Normal interval, MARCH ========
 const geo=()=>p.evaluate(()=>{ const sol=FG.state().soldiers, h=FG.F.path.posAt(FG.F.ranks[0].s).h, d=[Math.sin(h),-Math.cos(h)], n=[Math.cos(h),Math.sin(h)];
   const r=[...new Set(sol.map(s=>Math.round((s[0]*n[0]+s[1]*n[1])*1000)/1000))].sort((a,b)=>a-b), f=[...new Set(sol.map(s=>Math.round((s[0]*d[0]+s[1]*d[1])*1000)/1000))].sort((a,b)=>a-b);
   const v=FG.visual(); return {r, f, iv:FG.F.interval, rd:FG.F.rankDist, sloppy:FG.cover().sloppy, maxOff:Math.max(...v.map(s=>Math.hypot(s.vx-s.x,s.vy-s.y)))}; });
 const bangOnly=(t,ms)=>p.evaluate((t,ms)=>{ const b0=FG.bang().n, st=JSON.stringify(FG.state()), iv=FG.F.interval, cv=JSON.stringify(FG.cover()); FG.cmd(t); FG.sim(ms||1500);
   return FG.bang().n===b0+1 && FG.F.interval===iv && JSON.stringify(FG.cover())===cv && (FG.G.move!=="halt" || FG.phase()!=="formed" || JSON.stringify(FG.state())===st); },t,ms);
 // rule 1: before Fall in / never closed / already normal / marching / hands up / arms up
 await p.evaluate(()=>{ FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none"; });
 const n1=await bangOnly("normal interval march");
 ck(n1, "Normal interval before Fall in: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300); FG.G.recruits.length=0; });
 ck(await bangOnly("normal interval march"), "Normal interval when never closed (ragged, just fell in): '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("cover"); FG.sim(2600); });
 ck(await bangOnly("normal interval march"), "Normal interval with arms up at COVER: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1200); });
 ck(await bangOnly("normal interval march"), "Normal interval when already at normal interval: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("at close interval march"); FG.sim(2600); });
 ck(await bangOnly("normal interval march"), "Normal interval with hands on hips: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1200); FG.cmd("forward march"); FG.sim(2000); });
 ck(await bangOnly("normal interval march"), "Normal interval while marching: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("platoon halt"); FG.sim(2500); });
 // rule 2 + 3: back to the exact old interval, right file fixed, ragged stays ragged
 const g0=await geo();
 await p.evaluate(()=>{ dishevel(); FG.sim(300); });
 await shot('closeint-4-normal-before'); await zoom('closeint-4-normal-before-zoom');
 const gr=await geo();
 const mid2=await p.evaluate(()=>{ FG.cmd("normal interval march"); for(let i=0;i<60 && FG.F.interval!==1;i++) FG.sim(16); FG.sim(400); return {iv:FG.F.interval, moving:FG.state().soldiers.length && FG.G.soldiers===undefined}; });
 await p.evaluate(()=>FG.sim(1800));
 const g1=await geo();
 await shot('closeint-5-normal-after'); await zoom('closeint-5-normal-after-zoom');
 ck(Math.abs(g0.iv-0.75)<1e-9 && g1.iv===1 && g1.r.length===4 && g1.r.every((x,i)=>!i||Math.abs(x-g1.r[i-1]-1)<0.002), `Normal interval: ${g0.iv} → ${g1.iv} step, files at ${g1.r.join(", ")} (the spacing before At close interval)`);
 ck(Math.abs(g1.r[3]-g0.r[3])<0.002 && g1.r[0]<g0.r[0]-0.7, `right file stood fast (${g0.r[3]} → ${g1.r[3]}), others moved back out (left file ${g0.r[0]} → ${g1.r[0]})`);
 ck(Math.abs(g1.rd-g0.rd)<1e-9 && g1.f.join()===g0.f.join(), "distance between ranks unchanged");
 ck(gr.sloppy && g1.sloppy && g1.maxOff>0.05 && !(await p.evaluate(()=>FG.cover().cover)), `not a replacement for COVER: ragged before (${gr.maxOff.toFixed(2)}) and still ragged after (${g1.maxOff.toFixed(2)}), no arms`);
 ck(await bangOnly("normal interval march"), "Normal interval twice: second one is '!' (no longer at close interval)");
 // rule 4: COVER at close interval restores normal interval and aligns
 const c4=await p.evaluate(()=>{ FG.cmd("at close interval march"); FG.sim(2600); FG.cmd("recover"); FG.sim(1200); dishevel(); FG.sim(300); const s0=FG.cover().sloppy, iv0=FG.F.interval;
   FG.cmd("cover"); FG.sim(2600); const iv1=FG.F.interval, v=FG.visual(), off=Math.max(...v.map(s=>Math.hypot(s.vx-s.x,s.vy-s.y)+Math.abs(s.df))), kind=FG.cover().kind; FG.cmd("recover"); FG.sim(1200);
   const b0=FG.bang().n; FG.cmd("normal interval march"); FG.sim(1500); return {s0, iv0, iv1, off, kind, sloppy:FG.cover().sloppy, afterErr:FG.bang().n===b0+1}; });
 const g4=await geo();
 ck(c4.s0 && c4.iv0===0.75 && c4.kind==="cover" && c4.iv1===1 && c4.off===0 && !c4.sloppy && g4.r.every((x,i)=>!i||Math.abs(x-g4.r[i-1]-1)<0.002) && Math.abs(g4.r[3]-g0.r[3])<0.002,
   `COVER at close interval replaces Normal interval: ${c4.iv0} → ${c4.iv1}, aligned exactly (offset ${c4.off}), right file fixed; Normal interval afterwards is '!' (${c4.afterErr})`);
 const ds=await p.evaluate(()=>{ FG.cmd("at close interval march"); FG.sim(2600); FG.cmd("recover"); FG.sim(5000); const s=FG.sgt(); return {out:s.out, toT:s.toTarget}; });
 ck(Math.abs(ds.out-2)<0.15 && ds.toT<0.3, `drill sergeant 2 steps off the LEFT flank at close interval (out ${ds.out}, to target ${ds.toT})`);
 ck(errs.length===0, "no page errors "+errs.join(" | "));
 console.log(fails? fails+" FAILED" : "ALL PASS");
 await b.close(); process.exit(fails?1:0);
})();
