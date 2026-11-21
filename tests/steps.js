// "(1–4) steps to the Right/Left, MARCH": guarded sidestep that halts on its own.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 const zoom=async n=>{ const c=await p.evaluate(()=>{ const r=cv.getBoundingClientRect(), f=r.width/cv.width, sol=FG.state().soldiers;
   const xs=sol.map(s=>s[0]), ys=sol.map(s=>s[1]); const S=FG.G.sgt; if(S){ xs.push(S.x); ys.push(S.y); }
   const x0=Math.min(...xs)-1.5, x1=Math.max(...xs)+1.5, y0=Math.min(...ys)-1.5, y1=Math.max(...ys)+1.5, X=x=>r.left+(view.ox+x*view.scale)*f, Y=y=>r.top+(view.oy+y*view.scale)*f;
   return {x:X(x0), y:Y(y0), width:X(x1)-X(x0), height:Y(y1)-Y(y0)}; });
   const full=P.resolve(__dirname,'../shots/'+n.replace('-zoom','')+'.png'), out=P.resolve(__dirname,'../shots/'+n+'.png');
   require('child_process').execFileSync('/usr/bin/python3',['-c',`from PIL import Image; im=Image.open('${full}'); c=im.crop((${Math.round(c.x*2)},${Math.round(c.y*2)},${Math.round((c.x+c.width)*2)},${Math.round((c.y+c.height)*2)})); c.resize((c.width*3,c.height*3),Image.LANCZOS).save('${out}')`]); };
 // ---- recognition
 const P1=await p.evaluate(()=>{ const f=t=>{ const r=parseCommand(t); return r? (r.cmd.id==="nsteps"? `nsteps:${r.cmd.n}${r.cmd.dir}` : r.cmd.id) : null; };
   const yes={"3 steps to the left march":"nsteps:3L","three steps to the left, MARCH!":"nsteps:3L","two steps to the right march":"nsteps:2R","to steps to the write march":"nsteps:2R","too steps to the right march":"nsteps:2R",
     "for steps to the left march":"nsteps:4L","four steps to the left harch":"nsteps:4L","one step to the right march":"nsteps:1R","won step too the rite march":"nsteps:1R","platoon, 4 steps to the right, march":"nsteps:4R","1 step to the lift march":"nsteps:1L","tree steps to the left march":"nsteps:3L"};
   const bad={"5 steps to the left march":"nsteps:5L","0 steps to the right march":"nsteps:0R","twenty steps to the left march":"nsteps:20L","steps to the left march":"nsteps:nullL","a step to the right march":"nsteps:nullR",
     "3 steps forward march":"nsteps:3bad","2 steps to the rear march":"nsteps:2bad","4 steps backward march":"nsteps:4bad"};
   const chat=["3 steps to the left","my phone fell 3 steps to the left","i took three steps to the left march","three steps to the left of the door march","steps","we walked 3 steps"];
   return {yes:Object.entries(yes).map(([t,w])=>[t,f(t),w]), bad:Object.entries(bad).map(([t,w])=>[t,f(t),w]), chat:chat.map(t=>[t,f(t)]),
     old:[f("right step march"),f("left step march"),f("forward march"),f("backward march")], prep:(()=>{const r=parsePrepOnly("three steps to the left"); return r&&r.id+":"+r.n+r.dir;})()}; });
 ck(P1.yes.every(x=>x[1]===x[2]), "valid calls + sound-alikes: "+P1.yes.map(x=>x[0]+"="+x[1]).join(", "));
 ck(P1.bad.every(x=>x[1]===x[2]), "bad count/direction still recognised (so the DS can flag it): "+P1.bad.map(x=>x[0]+"="+x[1]).join(", "));
 ck(P1.chat.every(x=>x[1]!=="nsteps"), "chatter not taken: "+P1.chat.map(x=>x[0]+"="+x[1]).join(", "));
 ck(P1.old.join()==="rstep,lstep,forward,back", "Right/Left step, Forward, Backward unchanged");
 ck(P1.prep==="nsteps:3L", "prep alone ('three steps to the left', then MARCH) arms the voice burst like other commands");

 const geo=()=>p.evaluate(()=>{ const sol=FG.state().soldiers, h=FG.F.path.posAt(FG.F.ranks[0].s).h, n=[Math.cos(h),Math.sin(h)], d=[Math.sin(h),-Math.cos(h)];
   let cx=0, cy=0; sol.forEach(s=>{cx+=s[0]; cy+=s[1];}); cx/=sol.length; cy/=sol.length;
   return {cx, cy, n, d, h:Math.round(((h*180/Math.PI)%360+360)%360), faces:sol.map(s=>s[2]), move:FG.G.move, busy:FG.G.busy, posture:FG.G.posture, over:FG.G.over, iv:FG.F.interval}; });
 const bangOnly=t=>p.evaluate(t=>{ const b0=FG.bang().n, st=JSON.stringify(FG.state()); FG.cmd(t); FG.sim(2500); return {bang:FG.bang().n-b0, same:JSON.stringify(FG.state())===st}; },t);
 // before Fall in
 await p.evaluate(()=>{ FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none"; });
 const bf=await p.evaluate(()=>{ const b0=FG.bang().n; FG.cmd("3 steps to the left march"); FG.sim(2500); return {bang:FG.bang().n-b0, phase:FG.phase()}; });
 ck(bf.bang===1 && bf.phase==="scatter", "before Fall in: '!' and nothing happens");
 await p.evaluate(()=>{ FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300); FG.G.recruits.length=0; FG.cmd("cover"); FG.sim(2600); FG.cmd("recover"); FG.sim(1200); });
 // ---- valid 1-4 both directions (facing north)
 const runN=async(t,n,sgn)=>{ const g0=await geo(); const r=await p.evaluate(t=>{ const b0=FG.bang().n; FG.cmd(t); let mid={move:"halt", busy:null}; for(let i=0;i<30;i++){ FG.sim(50); if(FG.G.move!=="halt"){ mid={move:FG.G.move, busy:FG.G.busy}; break; } } FG.sim(4000); return {bang:FG.bang().n-b0, mid}; },t);
   const g1=await geo(); const dx=g1.cx-g0.cx, dy=g1.cy-g0.cy, lat=dx*g0.n[0]+dy*g0.n[1], fwd=dx*g0.d[0]+dy*g0.d[1];
   return {r, lat, fwd, want:sgn*n*0.5, g0, g1}; };
 for(const [t,n,s] of [["one step to the right march",1,1],["two steps to the right march",2,1],["three steps to the right march",3,1],["four steps to the right march",4,1],
                      ["one step to the left march",1,-1],["two steps to the left march",2,-1],["three steps to the left march",3,-1],["4 steps to the left march",4,-1]]){
   const x=await runN(t,n,s);
   ck(x.r.bang===0 && /^(r|l)step$/.test(x.r.mid.move) && x.r.mid.busy && Math.abs(x.lat-x.want)<1e-6 && Math.abs(x.fwd)<1e-6 && x.g1.move==="halt" && !x.g1.busy && x.g1.posture==="attention" && x.g1.faces.join()===x.g0.faces.join(),
     `"${t}": sidesteps ${x.lat.toFixed(3)} (= ${n} × 15 in), no forward drift, facing kept (${x.g1.h}°), halts by itself at attention`);
 }
 await shot('steps-1-before'); await zoom('steps-1-before-zoom');
 // during the sidestep: other movement commands are wrong-moment; screenshot mid-step
 const dur=await p.evaluate(()=>{ FG.cmd("four steps to the right march"); FG.sim(600); const res=[]; for(const t of ["forward march","platoon halt","right face","3 steps to the left march","cover"]){ const b0=FG.bang().n; FG.cmd(t); FG.sim(50); res.push([t,FG.bang().n-b0]); } return {res, move:FG.G.move}; });
 await shot('steps-2-sidestepping'); await zoom('steps-2-sidestepping-zoom');
 const fin=await p.evaluate(()=>{ FG.sim(4000); return {move:FG.G.move, busy:FG.G.busy}; });
 ck(dur.res.every(x=>x[1]===1) && fin.move==="halt" && !fin.busy, "while sidestepping, other commands are '!' and the step finishes and halts: "+dur.res.map(x=>x.join(":")).join(", "));
 await shot('steps-3-after'); await zoom('steps-3-after-zoom');
 // ---- every facing, both directions
 for(let i=0;i<4;i++){
   await p.evaluate(()=>{ FG.cmd("right face"); FG.sim(1800); });
   const a=await runN("two steps to the right march",2,1), c=await runN("three steps to the left march",3,-1);
   ck(a.r.bang===0 && c.r.bang===0 && Math.abs(a.lat-1)<1e-6 && Math.abs(c.lat+1.5)<1e-6 && Math.abs(a.fwd)<1e-6 && Math.abs(c.fwd)<1e-6 && a.g1.h===a.g0.h && c.g1.move==="halt",
     `facing ${a.g0.h}°: 2 right = ${a.lat.toFixed(2)}, 3 left = ${c.lat.toFixed(2)} relative to facing, facing kept`);
 }
 // ---- rejections: count, direction, marching, parade rest, stand at ease, arms up
 for(const t of ["5 steps to the left march","0 steps to the right march","twenty steps to the right march","steps to the left march","3 steps forward march","2 steps to the rear march","4 steps backward march"]){
   const r=await bangOnly(t); ck(r.bang===1 && r.same, `"${t}": '!' and nothing moves`); }
 const mr=await p.evaluate(()=>{ FG.cmd("forward march"); FG.sim(1500); const b0=FG.bang().n, mv=FG.G.move; const g=FG.F.path.posAt(FG.F.ranks[0].s).h; FG.cmd("3 steps to the left march"); FG.sim(1000);
   const r={bang:FG.bang().n-b0, move:FG.G.move, nstep:FG.G.nstep}; FG.cmd("platoon halt"); FG.sim(2500); return r; });
 ck(mr.bang===1 && mr.move==="forward" && !mr.nstep, "while marching: '!' and they keep marching forward (no sidestep)");
 for(const pre of ["parade rest","stand at ease"]){
   await p.evaluate(t=>{ FG.cmd(t); FG.sim(1500); },pre);
   const r=await bangOnly("2 steps to the right march"); ck(r.bang===1 && r.same, `at ${pre}: '!' and nothing moves (attention required)`);
   await p.evaluate(()=>{ FG.cmd("platoon attention"); FG.sim(1500); });
 }
 await p.evaluate(()=>{ FG.cmd("cover"); FG.sim(2600); });
 const ca=await bangOnly("2 steps to the right march"); ck(ca.bang===1 && ca.same, "with arms up at COVER: '!' and nothing moves");
 await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1200); });
 // ---- close interval kept, DS follows on the left flank
 const ci=await p.evaluate(()=>{ FG.cmd("at close interval march"); FG.sim(2600); FG.cmd("recover"); FG.sim(1200); return FG.F.interval; });
 const x=await runN("four steps to the left march",4,-1);
 const ds=await p.evaluate(()=>{ FG.sim(3000); const s=FG.sgt(); return {out:s.out, toT:s.toTarget}; });
 const sp=await p.evaluate(()=>{ const sol=FG.state().soldiers, h=FG.F.path.posAt(FG.F.ranks[0].s).h, n=[Math.cos(h),Math.sin(h)]; return [...new Set(sol.map(s=>Math.round((s[0]*n[0]+s[1]*n[1])*1000)/1000))].sort((a,b)=>a-b); });
 ck(ci===0.75 && Math.abs(x.lat+2)<1e-6 && sp.every((v,i)=>!i||Math.abs(v-sp[i-1]-0.75)<0.002), `close interval kept through 4 steps left (files ${sp.join(", ")})`);
 ck(Math.abs(ds.out-2)<0.15 && ds.toT<0.3, `drill sergeant follows, 2 steps off the left flank (out ${ds.out})`);
 // ---- wall rule unchanged: sidestepping into the wall breaks the formation
 const wl=await p.evaluate(()=>{ FG.cmd("cover"); FG.sim(2600); FG.cmd("recover"); FG.sim(1200);
   const h=FG.F.path.posAt(FG.F.ranks[0].s).h, n=[Math.cos(h),Math.sin(h)]; const sol=FG.state().soldiers;
   // move the formation next to the wall on its left (test setup)
   let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9; sol.forEach(s=>{minX=Math.min(minX,s[0]);maxX=Math.max(maxX,s[0]);minY=Math.min(minY,s[1]);maxY=Math.max(maxY,s[1]);});
   const leftEdge = -n[0]>0.5 ? SNAKE_W-maxX : -n[0]<-0.5 ? minX : -n[1]>0.5 ? SNAKE_H-maxY : minY;   // room on the left side
   FG.F.path.translate(-n[0]*(leftEdge-0.8), -n[1]*(leftEdge-0.8)); FG.F._fi=null; FG.sim(300);
   const over0=FG.G.over; FG.cmd("four steps to the left march"); FG.sim(3500);
   return {over0, over:FG.G.over, txt:document.getElementById("ovText").textContent}; });
 ck(!wl.over0 && wl.over && /wall/i.test(wl.txt), `sidestepping into the wall: formation broke, same wall rule ("${wl.txt.split(".")[0]}")`);
 ck(errs.length===0, "no page errors "+errs.join(" | "));
 console.log(fails? fails+" FAILED" : "ALL PASS");
 await b.close(); process.exit(fails?1:0);
})();
