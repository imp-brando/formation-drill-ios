// Cover down after a Rear march / About face (user, t81u): when the about face puts the short (extra)
// rank in front, the files holding the extra men slow down while the other files keep marching and catch
// up, until the short rank is at the rear and every rank is dressed. Nobody is reassigned across the
// formation, nobody passes through anybody, and nobody moves faster than a normal (1.25-step) stride.
// At the halt the same happens with natural steps forward and back.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:3}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 await p.evaluate(()=>{
  window.__noWalls=true;
  window.R={
   fresh(mode,extra){ FG.startHeadless(mode||'drill',true); FG.setRecOn(true); FG.settings.sens="none"; FG.cmd("fall in"); FG.formNow(); FG.sim(1500);
     FG.cmd("cover"); FG.sim(3000); FG.cmd("recover"); FG.sim(3000);
     for(let i=0;i<(extra??2);i++) FG.addRecruit(); FG.sim(2500); },
   grid(){ return FG.F.ranks.map(rk=>rk.sol.map(s=>s?'o':'.').join('')).join('|'); },
   all(){ const o=[]; FG.F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(s) o.push({s,r,q}); })); return o; },
   /** issue cmd, follow frame by frame until the formation has turned and every slip is worked off */
   track(cmd, maxBeats){
     const h0=FG.state().heading, per=clock.period; FG.cmd(cmd);
     let k=0; while(Math.abs(((FG.state().heading-h0+360)%360)-180)>1 && k<400){ FG.sim(16); k++; }
     const ids=new Map(R.all().map(o=>[o.s.id,o.s])), frames=[]; let tDone=null;
     const t0=simNow;
     for(let f=0; f<Math.round(maxBeats*per/16); f++){
       FG.sim(16);
       frames.push({t:(simNow-t0)/per, p:[...ids].map(([id,s])=>[id,s.x,s.y]), slip:Math.max(0,...[...ids.values()].map(s=>Math.abs(s.slip||0)))});
       if(tDone===null && frames[frames.length-1].slip===0 && f>2) tDone=frames[frames.length-1].t;
     }
     return {frames, tDone, turnFrames:k};
   },
   analyse(tr, files){
     const F=FG.F, h=F.path.posAt(F.ranks[0].s).h, d=dirV(h), n=nrmV(h), fr=tr.frames;
     const fileOf=new Map(R.all().map(o=>[o.s.id,o.q]));
     let vmax=0, dmin=9, lateral=0, order=0;
     const v0=new Map(fr[0].p.map(([id,x,y])=>[id, x*n[0]+y*n[1]]));
     for(let i=1;i<fr.length;i++){
       const dt=fr[i].t-fr[i-1].t, a=new Map(fr[i-1].p.map(([id,x,y])=>[id,[x,y]]));
       for(const [id,x,y] of fr[i].p){ const q=a.get(id); vmax=Math.max(vmax, Math.hypot(x-q[0],y-q[1])/dt);
         lateral=Math.max(lateral, Math.abs(x*n[0]+y*n[1]-v0.get(id))); }
       const P2=fr[i].p; for(let j=0;j<P2.length;j++) for(let k=j+1;k<P2.length;k++) dmin=Math.min(dmin, Math.hypot(P2[j][1]-P2[k][1],P2[j][2]-P2[k][2]));
     }
     // order along each file never changes (nobody passes anybody in his file)
     const u=(fp,id)=>{ const e=fp.find(z=>z[0]===id); return e[1]*d[0]+e[2]*d[1]; };
     const ids=fr[0].p.map(z=>z[0]); const sameFile={};
     ids.forEach(id=>{ const q=fileOf.get(id); (sameFile[q]=sameFile[q]||[]).push(id); });
     const key=fp=>Object.values(sameFile).map(g=>g.slice().sort((A,B)=>u(fp,B)-u(fp,A)).join(',')).join('|');
     const k0=key(fr[0].p); for(const f of fr) if(key(f.p)!==k0) { order++; }
     // advance of the extra men's files vs the others over the first 1.5 beats
     const iA=fr.findIndex(f=>f.t>=2.5); const adv=(grp)=>{ let s=0,c=0; for(const id of ids){ if(!grp(fileOf.get(id))) continue; s+=u(fr[iA].p,id)-u(fr[0].p,id); c++; } return c? s/c : 0; };
     return {vmax, dmin, lateral, order, advExtra:adv(q=>files.includes(q)), advOther:adv(q=>!files.includes(q))};
   },
   shape(){ const F=FG.F, g=R.grid().split('|'), D=g.length;
     return {g:R.grid(), dressed: g.slice(0,D-1).every(r=>!r.includes('.')), rearShort: g[D-1].includes('.'), front:g[0]}; },
   extraFiles(){ const F=FG.F, rk=F.ranks[F.ranks.length-1]; return rk.sol.map((s,q)=>s?q:-1).filter(q=>q>=0); },
  };
 });

 // 1) marching: Forward, then Rear march with 18 soldiers
 const m=await p.evaluate(()=>{ R.fresh(); FG.cmd("forward march"); FG.sim(4000); const g0=R.grid();
   const tr=R.track("rear march", 6), sh=R.shape(), files=R.extraFiles(), a=R.analyse(tr, files);
   return {g0, sh, a, tDone:tr.tDone, n:FG.state().soldiers.length, move:FG.state().move}; });
 ck(m.n===18 && m.sh.dressed && m.sh.rearShort && m.sh.front==='oooo', `rear march, 18 soldiers: short rank ends at the rear, front rank and all others dressed (${m.g0} → ${m.sh.g})`);
 ck(m.a.advExtra < m.a.advOther-0.2, `rear march: the extra men's files lag (${m.a.advExtra.toFixed(2)} vs ${m.a.advOther.toFixed(2)} over the first 2.5 beats) while the others keep marching`);
 ck(m.a.vmax<=1.3, `rear march: nobody faster than a 1.25-step stride, no jumps (max ${m.a.vmax.toFixed(2)} per beat)`);
 ck(m.a.dmin>=0.6 && m.a.lateral<0.08 && !m.a.order, `rear march: nobody passes through anybody (closest ${m.a.dmin.toFixed(2)}, off lane ${m.a.lateral.toFixed(3)}, order changes ${m.a.order})`);
 ck(m.tDone!==null && m.tDone<=4, `rear march: dressed again within ${m.tDone&&m.tDone.toFixed(1)} beats (≤ 4) and still marching (${m.move})`);

 // 2) at the halt: About face with 18 soldiers
 const h=await p.evaluate(()=>{ R.fresh(); const g0=R.grid();
   const tr=R.track("about face", 5), sh=R.shape(), a=R.analyse(tr, R.extraFiles()); return {g0, sh, a, tDone:tr.tDone, move:FG.state().move}; });
 ck(h.sh.dressed && h.sh.rearShort && h.sh.front==='oooo', `about face at the halt: short rank steps back to the rear (${h.g0} → ${h.sh.g})`);
 ck(h.a.vmax<=1.0 && h.a.dmin>=0.6 && h.a.lateral<0.08 && !h.a.order, `about face at the halt: natural steps forward and back, nobody cuts across (max ${h.a.vmax.toFixed(2)}/beat, closest ${h.a.dmin.toFixed(2)}, off lane ${h.a.lateral.toFixed(3)})`);
 ck(h.tDone!==null && h.tDone<=3 && h.move==="halt", `about face at the halt: done within ${h.tDone&&h.tDone.toFixed(1)} beats, still halted`);

 // 3) the user's photo (t81u): Left, FACE (short file trailing at the rear), then About face: the short
 //    file slows (steps back) while the others come up, so its men are trailing at the rear again
 const l=await p.evaluate(()=>{ R.fresh(); FG.cmd("left face"); FG.sim(2500); const g0=R.grid();
   const tr=R.track("about face", 5), a=R.analyse(tr, []); const g=R.grid().split('|');
   const fileQ=FG.F.ranks[0].sol.findIndex(x=>!x)>=0 ? -1 : FG.F.ranks.findIndex(()=>0);
   const short=[...Array(FG.F.W).keys()].filter(q=>FG.F.ranks.some(rk=>!rk.sol[q]));
   const atRear=short.every(q=>{ const fr=[]; FG.F.ranks.forEach((rk,r)=>{ if(rk.sol[q]) fr.push(r); }); return fr[fr.length-1]===FG.F.ranks.length-1; });
   return {g0, g:R.grid(), atRear, short, a, tDone:tr.tDone}; });
 ck(l.atRear && l.short.length===1, `Left face then About face: the short line's men trail at the rear again (${l.g0} → ${l.g})`);
 ck(l.a.vmax<=1.0 && l.a.dmin>=0.6 && l.a.lateral<0.08 && !l.a.order && l.tDone!==null && l.tDone<=3, `…with natural steps, nobody cuts across (max ${l.a.vmax.toFixed(2)}/beat, closest ${l.a.dmin.toFixed(2)}, done in ${l.tDone&&l.tDone.toFixed(1)} beats)`);

 // 4) two rear marches back to back, then a column left: still one short rank at the rear, still clean
 const s2=await p.evaluate(()=>{ R.fresh(); FG.cmd("forward march"); FG.sim(3000); R.track("rear march",4); R.track("rear march",4); FG.cmd("column left march"); FG.sim(5000); return {sh:R.shape(), over:FG.G.over}; });
 ck(s2.sh.dressed && s2.sh.rearShort && !s2.over, `rear march twice then column left: short rank still at the rear (${s2.sh.g})`);

 // screenshot sequence: marching, rear march → the extra men's files slow down while the others catch up
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 await p.evaluate(()=>{ R.fresh('snake'); FG.cmd("forward march"); FG.sim(2500); }); await shot('rearmarch-1');
 await p.evaluate(()=>{ const h0=FG.state().heading; FG.cmd("rear march"); let k=0; while(Math.abs(((FG.state().heading-h0+360)%360)-180)>1 && k<400){ FG.sim(16); k++; } FG.sim(80); }); await shot('rearmarch-2');
 await p.evaluate(()=>FG.sim(clock.period*2.1)); await shot('rearmarch-3');
 await p.evaluate(()=>FG.sim(clock.period*2.5)); await shot('rearmarch-4');
 // crop round the formation (and the DS beside it)
 require('child_process').execFileSync('python3',['-c',`
from PIL import Image
import numpy as np
for i in range(1,5):
    f='${P.resolve(__dirname,'../shots')}/rearmarch-%d.png'%i; im=Image.open(f).convert('RGB'); a=np.asarray(im).astype(int); h=a.shape[0]
    d=(a.sum(axis=2)<200); d[:int(h*.08)]=False; d[int(h*.78):]=False
    ys,xs=np.nonzero(d); cx,cy=int(np.median(xs)),int(np.median(ys)); W,H=420,480
    x0=max(0,min(im.width-W,cx-W//2)); y0=max(0,min(im.height-H,cy-H//2)); im.crop((x0,y0,x0+W,y0+H)).save(f)
`]);
 ck(!errs.length, 'no page errors '+errs.join(' | '));
 console.log(fails?`${fails} FAILED`:'ALL PASS'); await b.close(); process.exit(fails?1:0);
})();
