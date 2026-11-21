// Measures counter column completion (beats) and the closest any two soldiers get; screenshots mid/after.
const puppeteer=require('puppeteer-core'), P=require('path');
const tag=process.argv[2]||'now';
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 const out={};
 for(const mode of ['drill','snake']){
  await p.evaluate(m=>{ FG.startHeadless(m); FG.G.recruits=[]; },mode);
  if(mode==='snake') await p.evaluate(()=>{ for(let i=0;i<8;i++) FG.addRecruit && FG.addRecruit(); });
  await p.evaluate(()=>FG.cmd('forward march')); await p.evaluate(()=>FG.sim(1200));
  await p.evaluate(()=>FG.cmd('counter column march'));
  const r=await p.evaluate(()=>{ let beats=0, minD=9, k0=FG.clock.k, mid=false;
    while(FG.F.mode!=="counter" && beats<4){ FG.sim(50); }
    const kStart=FG.clock.k;
    for(let i=0;i<4000 && FG.F.mode==="counter";i++){ FG.sim(16);
      const s=FG.state().soldiers; for(let a=0;a<s.length;a++) for(let c=a+1;c<s.length;c++) minD=Math.min(minD,Math.hypot(s[a][0]-s[c][0],s[a][1]-s[c][1])); }
    return {beats:FG.clock.k-kStart, minD:+minD.toFixed(2), soldiers:FG.state().soldiers.length, over:FG.G.over}; });
  out[mode]=r;
 }
 // screenshots: drill counter mid and after
 await p.evaluate(()=>{ FG.startHeadless('drill'); }); await p.evaluate(()=>FG.cmd('forward march')); await p.evaluate(()=>FG.sim(1200));
 await p.evaluate(()=>FG.cmd('counter column march')); await p.evaluate(()=>FG.sim(2600));
 await p.screenshot({path:P.resolve(__dirname,`../shots/counter-mid-${tag}.png`)});
 await p.evaluate(()=>{ for(let i=0;i<3000 && FG.F.mode==="counter";i++) FG.sim(16); FG.sim(1500); });
 await p.screenshot({path:P.resolve(__dirname,`../shots/counter-after-${tag}.png`)});
 const sp=await p.evaluate(()=>{ const F=FG.F, ds=[], iv=[]; const pos=F.ranks.map(rk=>rk.sol.map(s=>s?[s.x,s.y]:null));
   for(const rk of pos) for(let i=0;i<rk.length-1;i++) if(rk[i]&&rk[i+1]) iv.push(Math.hypot(rk[i][0]-rk[i+1][0],rk[i][1]-rk[i+1][1]));
   for(let r=1;r<pos.length;r++) for(let q=0;q<4;q++) if(pos[r][q]&&pos[r-1][q]) ds.push(Math.hypot(pos[r][q][0]-pos[r-1][q][0],pos[r][q][1]-pos[r-1][q][1]));
   return {iv:[Math.min(...iv),Math.max(...iv)].map(x=>+x.toFixed(2)), dist:[Math.min(...ds),Math.max(...ds)].map(x=>+x.toFixed(2))}; });
 console.log(tag, JSON.stringify(out), 'after spacing', JSON.stringify(sp), 'errors', errs);
 await b.close();
})();
