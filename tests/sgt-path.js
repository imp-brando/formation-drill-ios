// Drill sergeant wrap-around: trace his path through a rear march and a counter column, measure
// path length, widest distance from the formation, closest approach, and beats until he is back on post.
const puppeteer=require('puppeteer-core'), P=require('path');
const TAG=process.argv[2]||"after";
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 const out={};
 for(const cmd of ["rear march","counter column march"]){
  const r=await p.evaluate(cmd=>{
   window.__noWalls=true; FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none";
   FG.sim(600); FG.cmd("forward march"); FG.sim(2400);
   window.__trace=[]; FG.cmd(cmd); const t0=FG.now(), per=FG.clock.period;
   const rel=[]; let len=0, maxD=0, minD=99, last=null, onPostAt=null, settled=0;
   for(let t=0;t<12000;t+=32){ FG.sim(32); const s=FG.sgt(); rel.push([s.u,s.v]);
     if(last) len+=Math.hypot(s.x-last[0],s.y-last[1]); last=[s.x,s.y];
     maxD=Math.max(maxD,s.minDist); minD=Math.min(minD,s.minDist);
     const done = Math.abs(s.out-2)<0.15 && Math.abs(s.depthOff)<0.15 && FG.F.mode!=="counter" && !FG.G.busy;
     if(done){ if(onPostAt===null) onPostAt=FG.now(); } else onPostAt=null;
   }
   { const f=FG.sgt(), d=[Math.sin(f.hr),-Math.cos(f.hr)], n=[Math.cos(f.hr),Math.sin(f.hr)];
     window.__trace=rel.map(([u,v])=>[f.cx+d[0]*u+n[0]*v, f.cy+d[1]*u+n[1]*v]); }
   const fwdLen=12000/per*1.0;      // what he walks anyway marching alongside (1 step per beat)
   return {pathLen:+len.toFixed(1), extraOverMarch:+(len-fwdLen).toFixed(1), maxDistFromFormation:+maxD.toFixed(2), minDist:+minD.toFixed(2),
           beatsToPost: onPostAt===null? null : +((onPostAt-t0)/per).toFixed(1), final:FG.sgt()};
  },cmd);
  out[cmd]=r;
  await p.evaluate(()=>FG.sim(16));
  await p.screenshot({path:P.resolve(__dirname,`../shots/sgt-path-${cmd.split(" ")[0]}-${TAG}.png`)});
 }
 await p.evaluate(()=>{ window.__trace=null; });
 console.log(JSON.stringify(out,null,1));
 const R=out["rear march"], C=out["counter column march"]; let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 ck(R.beatsToPost!==null && R.beatsToPost<=12, "rear march: back on post within 12 beats ("+R.beatsToPost+")");
 ck(R.maxDistFromFormation<=2.7, "rear march: hugs the formation, widest "+R.maxDistFromFormation+" steps from the nearest soldier");
 ck(R.minDist>=0.8 && C.minDist>=0.8, "never closer than 0.8 step to a soldier ("+R.minDist+", "+C.minDist+")");
 ck(C.beatsToPost!==null && C.beatsToPost<=11, "counter column: on the new left side within 11 beats ("+C.beatsToPost+")");
 console.log("fails",fails,"errors",JSON.stringify(errs)); await b.close(); process.exit(fails||errs.length?1:0);
})();
