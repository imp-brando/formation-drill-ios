// 90° column left/right: min soldier gap through the turn (no overlap), ranks square afterwards; screenshots incl. PICAA indicator.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let bad=0;
 for(const [cmd,tag] of [["column left march","colL"],["column right march","colR"]]){
  const r=await p.evaluate(async(cmd)=>{
   FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none";
   FG.sim(800); FG.cmd("forward march"); FG.sim(2000); FG.cmd(cmd);
   let minD=9; const pts=()=>FG.F.ranks.flatMap(rk=>rk.sol.filter(Boolean).map(s=>[s.x,s.y]));
   for(let i=0;i<120;i++){ FG.sim(25); const a=pts(); for(let x=0;x<a.length;x++)for(let y=x+1;y<a.length;y++) minD=Math.min(minD,Math.hypot(a[x][0]-a[y][0],a[x][1]-a[y][1])); if(i==36) window.__mid=1; }
   return {minD:+minD.toFixed(2), st:FG.state()};
  },cmd);
  console.log(tag,JSON.stringify({minD:r.minD}));
  if(r.minD<0.34) bad++;
 }
 // screenshots: mid-turn with indicator lit, and after
 await p.evaluate(()=>{ FG.startHeadless('drill'); FG.setRecOn(true); FG.sim(800); FG.cmd("forward march"); FG.sim(2000); FG.cmd("column left march"); FG.sim(560); });
 await p.screenshot({path:P.resolve(__dirname,'../shots/square-colL-mid.png')});
 await p.evaluate(()=>FG.sim(1700)); await p.screenshot({path:P.resolve(__dirname,'../shots/square-colL-after.png')});
 console.log('errors',errs); await b.close(); process.exit(bad||errs.length?1:0);
})();
