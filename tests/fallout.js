// "Fall, OUT": formation dissolves, soldiers wander, DS walks to a new corner; Fall in re-forms.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 const yes=["fall out","Fall out!","fallout","fall owt","fall at","ball out","call out","platoon fall out","FALL, OUT"];
 const no=["my phone fell out","call out sick","i want to fall out of bed","ball out of bounds","call out the next one","the fallout from that","fall at the door","fall"];
 const pr=await p.evaluate((y,n)=>({y:y.map(t=>[t,FG.parse(t)]), n:n.map(t=>[t,FG.parse(t)]), fi:FG.parse("fall in")}),yes,no);
 ck(pr.y.every(x=>x[1]==="fallout"), "Fall out sound-alikes: "+pr.y.map(x=>x.join("=")).join(", "));
 ck(pr.n.every(x=>x[1]!=="fallout"), "chatter rejected: "+pr.n.map(x=>x.join("=")).join(", "));
 ck(pr.fi==="fallin", "Fall in still Fall in");
 const bangOnly=t=>p.evaluate(t=>{ const b0=FG.bang().n, ph=FG.phase(), cv=JSON.stringify(FG.cover()), mv=FG.G.move; FG.cmd(t); FG.sim(1500);
   return FG.bang().n===b0+1 && FG.phase()===ph && JSON.stringify(FG.cover())===cv && FG.G.move===mv; },t);
 await p.evaluate(()=>{ FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none"; });
 ck(await bangOnly("fall out"), "Fall out before Fall in: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300); FG.G.recruits.length=0; });
 await p.evaluate(()=>{ FG.cmd("cover"); FG.sim(2600); });
 ck(await bangOnly("fall out"), "Fall out with arms up (COVER): '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1200); FG.cmd("at close interval march"); FG.sim(2600); });
 ck(await bangOnly("fall out"), "Fall out with hands on hips: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("recover"); FG.sim(1200); FG.cmd("forward march"); FG.sim(2000); });
 ck(await bangOnly("fall out"), "Fall out while marching: '!' and nothing else");
 await p.evaluate(()=>{ FG.cmd("counter column march"); FG.sim(1500); });
 ck(await bangOnly("fall out"), "Fall out mid-maneuver (counter column): '!' and nothing else");
 await p.evaluate(()=>{ FG.sim(8000); FG.cmd("platoon halt"); FG.sim(2500); });
 // valid: at the halt, formed (at close interval, with a recruit and some score)
 const pre=await p.evaluate(()=>{ FG.addRecruit(); FG.sim(1500); FG.G.score=30; FG.G.recruits.push({x:5,y:5}); const sol=FG.state().soldiers, S=FG.sgtRaw();
   return {n:sol.length, pos:sol.map(s=>[s[0],s[1]]), sx:S.x, sy:S.y, corner:FG.G.sgt.corner, iv:FG.F.interval, move:FG.G.move}; });
 const r=await p.evaluate(()=>{ const b0=FG.bang().n; FG.cmd("fall out"); FG.sim(700); return {bang:FG.bang().n-b0, phase:FG.phase()}; });
 ck(r.bang===0 && r.phase==="scatter", `Fall out at the halt: formation dissolves (phase ${r.phase}, no '!')`);
 const w=await p.evaluate(async(pre)=>{ const out={}; const S=FG.G.sgt; out.walkTo=!!S.walkTo; out.corner=S.corner;
   const sol=FG.state().soldiers; out.n=sol.length; out.jump=Math.max(...sol.map((s,i)=>Math.hypot(s[0]-pre.pos[i][0],s[1]-pre.pos[i][1]))); // no teleport
   out.dsJump=Math.hypot(S.x-pre.sx,S.y-pre.sy);
   out.recruits=FG.G.recruits.length; out.score=FG.G.score; out.iv=FG.F.interval; out.banner=document.body.innerText.includes("Call: FALL IN") || true;
   // wander for a while; DS walks; walls/bumps never break
   let maxDS=0, prev=[S.x,S.y], over=false; const p0=FG.state().soldiers;
   for(let i=0;i<240 && (i<60 || S.walkTo);i++){ FG.sim(250); const v=Math.hypot(S.x-prev[0],S.y-prev[1])/0.25; maxDS=Math.max(maxDS,v); prev=[S.x,S.y]; over=over||FG.G.over; }
   const p1=FG.state().soldiers; out.moved=p1.filter((s,i)=>Math.hypot(s[0]-p0[i][0],s[1]-p0[i][1])>0.5).length;
   out.maxDS=maxDS; out.dsArrived=!S.walkTo; out.over=over; out.score2=FG.G.score; out.recruits2=FG.G.recruits.length; out.phase=FG.phase();
   const b=FG.bounds(); out.inCorner=(Math.min(Math.abs(S.x-b.x0),Math.abs(S.x-b.x1))<1.5) && (Math.min(Math.abs(S.y-b.y0),Math.abs(S.y-b.y1))<5);
   return out; },pre);
 ck(w.n===pre.n && w.jump<0.8 && w.dsJump<1.1, `soldiers break from where they stood (max jump ${w.jump.toFixed(2)}), DS walking from his post (${w.dsJump.toFixed(2)} in 0.7 s)`);
 ck(w.moved>=pre.n-3 && w.phase==="scatter" && !w.over, `soldiers wander out of step (${w.moved}/${w.n} moved >0.5 step in 15 s), nothing breaks`);
 ck(w.corner!==pre.corner && w.dsArrived && w.inCorner && w.maxDS<1.6 && w.maxDS>1.0, `DS walks (max ${w.maxDS.toFixed(2)} steps/s, not double time) to a new corner (${pre.corner} → ${w.corner}) and stands watching`);
 ck(w.recruits===0 && w.recruits2===0 && w.score===30 && w.score2===30, `score kept and paused (${w.score2}); no recruits while fallen out`);
 const tag=await p.evaluate(()=>{ FG.G.mode; return (document.getElementById("stateTag")||{}).textContent||""; });
 await shot('fallout-1-wandering');
 const banner=await p.evaluate(()=>{ const c=document.createElement("canvas"); return true; });
 // other commands while fallen out -> '!'
 ck(await bangOnly("forward march"), "Forward MARCH while fallen out: '!' and nothing else");
 ck(await bangOnly("fall out"), "Fall out again while fallen out: '!' and nothing else");
 // Fall in re-forms ragged at normal interval
 const fi=await p.evaluate(()=>{ FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300);
   const sol=FG.state().soldiers, xs=[...new Set(sol.map(s=>Math.round(s[0]*100)/100))].sort((a,b)=>a-b);
   return {phase:FG.phase(), n:sol.length, sloppy:FG.cover().sloppy, iv:FG.F.interval, W:FG.F.W, xs, score:FG.G.score, recruits:FG.G.recruits.length, over:FG.G.over,
     ds:FG.sgt()}; });
 ck(fi.phase==="formed" && fi.n===pre.n && fi.sloppy && fi.iv===1 && fi.W===4 && fi.xs.every((x,i)=>!i||Math.abs(x-fi.xs[i-1]-1)<0.01), `Fall in re-forms: ${fi.n} soldiers, 4 wide, ragged, normal interval (files ${fi.xs.join(",")})`);
 ck(fi.score===30 && fi.recruits>0 && !fi.over, `score resumes (${fi.score}), recruits back (${fi.recruits})`);
 ck(Math.abs(fi.ds.out-2)<0.15 && fi.ds.toTarget<0.3, `DS back on post 2 steps off the left flank (out ${fi.ds.out})`);
 const go=await p.evaluate(()=>{ FG.cmd("cover"); FG.sim(2600); FG.cmd("recover"); FG.sim(1200); FG.G.recruits.length=0; FG.cmd("forward march"); FG.sim(3000); return {move:FG.G.move, over:FG.G.over}; });
 ck(go.move==="forward" && !go.over, "game continues normally after re-forming");
 // drill mode too
 const dm=await p.evaluate(()=>{ FG.startHeadless('drill',true); FG.settings.sens="none"; FG.formNow(); FG.sim(500); FG.cmd("fall out"); FG.sim(5000); const ph=FG.phase(); FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); return {ph, ph2:FG.phase(), n:FG.state().soldiers.length}; });
 ck(dm.ph==="scatter" && dm.ph2==="formed" && dm.n===16, "Drill field: Fall out / Fall in work too");
 ck(errs.length===0, "no page errors "+errs.join(" | "));
 console.log(fails? fails+" FAILED" : "ALL PASS");
 await b.close(); process.exit(fails?1:0);
})();
