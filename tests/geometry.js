const puppeteer=require('puppeteer-core'), __P=require('path');
const S=__P.resolve(__dirname,'../shots')+'/';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__P.resolve(__dirname,'../index.html'));
 const sim=ms=>p.evaluate(ms=>FG.sim(ms),ms), C=t=>p.evaluate(t=>FG.cmd(t),t);
 // spacing measured in the formation's own frame: interval = neighbours in a rank, distance = same file, rank to rank
 const meas=()=>p.evaluate(()=>{ const F=FG.F, iv=[], ds=[];
   const pos=F.ranks.map(rk=>rk.sol.map(s=>s?[s.x,s.y]:null));
   for(const rk of pos) for(let i=0;i<rk.length-1;i++) if(rk[i]&&rk[i+1]) iv.push(Math.hypot(rk[i][0]-rk[i+1][0],rk[i][1]-rk[i+1][1]));
   for(let r=1;r<pos.length;r++) for(let q=0;q<pos[r].length;q++) if(pos[r][q]&&pos[r-1][q]) ds.push(Math.hypot(pos[r][q][0]-pos[r-1][q][0],pos[r][q][1]-pos[r-1][q][1]));
   const h=Math.round(((F.ranks[0].sol.find(Boolean).face*180/Math.PI)%360+360)%360);
   return {ivMin:Math.min(...iv),ivMax:Math.max(...iv),dMin:Math.min(...ds),dMax:Math.max(...ds),h}; });
 const steady=(m,l)=>{ ok(m.ivMax<1.03&&m.ivMin>0.97&&m.dMax<1.07&&m.dMin>0.94, `${l}: heading ${m.h}°, interval ${m.ivMin.toFixed(2)}-${m.ivMax.toFixed(2)}, distance ${m.dMin.toFixed(2)}-${m.dMax.toFixed(2)}`); };
 await p.evaluate(()=>{ FG.startHeadless('drill'); });
 await C('forward march'); await sim(1500);
 await C('column half left march'); await sim(1400); let m=await meas();
 ok(m.dMax<2.0 && m.dMin>=0.34, `half left MID: heading ${m.h}°, distance ${m.dMin.toFixed(2)}-${m.dMax.toFixed(2)} (pivot side closes up briefly)`);
 await p.screenshot({path:S+'halfleft-mid.png'});
 await sim(6000); steady(await meas(),'after half left'); await p.screenshot({path:S+'halfleft-after.png'});
 await C('column left march'); await sim(2000); await p.screenshot({path:S+'diag-colleft-mid.png'});
 await sim(8000); steady(await meas(),'column left from diagonal'); await p.screenshot({path:S+'diag-colleft-after.png'});
 await C('column half right march'); await sim(1400); await p.screenshot({path:S+'halfright-mid.png'});
 await sim(6000); steady(await meas(),'after half right'); await p.screenshot({path:S+'halfright-after.png'});
 await C('column half right march'); await sim(7000); steady(await meas(),'second half right');
 await C('rear march'); await sim(3000); steady(await meas(),'rear march on a heading');
 // snake: diagonal into a wall must break the formation
 await p.evaluate(()=>{ FG.startHeadless('snake'); FG.G.recruits=[]; });
 await C('forward march'); await sim(1200); await C('column half left march'); await sim(5000);
 steady(await meas(),'snake after half left'); await p.screenshot({path:S+'snake-halfleft.png'});
 await sim(20000); const o=await p.evaluate(()=>({over:FG.G.over, why:document.getElementById('ovText').textContent}));
 ok(o.over && /wall/.test(o.why),'diagonal march into the wall breaks formation: '+o.why);
 console.log('errors',errs); await b.close(); process.exit(fails||errs.length?1:0);
})();
