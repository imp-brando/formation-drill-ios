// Stand at ease = look at the drill sergeant; At ease = no effect; Dress right: every file but the LEFT raises the arm.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 const zoom=async n=>{ const c=await p.evaluate(()=>{ const r=cv.getBoundingClientRect(), f=r.width/cv.width, sol=FG.state().soldiers;
   const xs=sol.map(s=>s[0]), ys=sol.map(s=>s[1]); const S=FG.G.sgt; if(S){ xs.push(S.x); ys.push(S.y); }
   const x0=Math.min(...xs)-1.2, x1=Math.max(...xs)+1.2, y0=Math.min(...ys)-1.2, y1=Math.max(...ys)+1.2, X=x=>r.left+(view.ox+x*view.scale)*f, Y=y=>r.top+(view.oy+y*view.scale)*f;
   return {x:X(x0), y:Y(y0), width:X(x1)-X(x0), height:Y(y1)-Y(y0)}; });
   const full=P.resolve(__dirname,'../shots/'+n.replace('-zoom','')+'.png'), out=P.resolve(__dirname,'../shots/'+n+'.png');
   require('child_process').execFileSync('/usr/bin/python3',['-c',`from PIL import Image; im=Image.open('${full}'); c=im.crop((${Math.round(c.x*2)},${Math.round(c.y*2)},${Math.round((c.x+c.width)*2)},${Math.round((c.y+c.height)*2)})); c.resize((c.width*3,c.height*3),Image.LANCZOS).save('${out}')`]); };
 await p.evaluate(()=>{ FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none"; FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300); FG.G.recruits.length=0; FG.cmd("cover"); FG.sim(2600); FG.cmd("recover"); FG.sim(1200); });
 await shot('ease-0-attention'); await zoom('ease-0-attention-zoom');
 ck(await p.evaluate(()=>FG.parse("at ease")==="atease" && FG.parse("stand at ease")==="standease"), "At ease and Stand at ease parse as different commands");
 // ---- At ease: no effect, no '!'
 const ae=await p.evaluate(()=>{ const b0=FG.bang().n, st=JSON.stringify(FG.state()), po=FG.G.posture; FG.cmd("at ease"); FG.sim(1500);
   const r1={bang:FG.bang().n-b0, same:JSON.stringify(FG.state())===st, posture:FG.G.posture===po};
   FG.cmd("forward march"); FG.sim(1500); const b1=FG.bang().n, mv=FG.G.move; FG.cmd("at ease"); FG.sim(1000); const r2={bang:FG.bang().n-b1, move:FG.G.move===mv};
   FG.cmd("platoon halt"); FG.sim(2500); return {r1,r2}; });
 ck(ae.r1.bang===0 && ae.r1.same && ae.r1.posture, "At ease at the halt: no effect, no '!'");
 ck(ae.r2.bang===0 && ae.r2.move, "At ease while marching: no effect, no '!'");
 // ---- Stand at ease: everyone looks at the DS
 const sa=await p.evaluate(()=>{ FG.cmd("stand at ease"); FG.sim(1500); const L=FG.look(); return {posture:FG.G.posture, L, look0:L.every(x=>x)}; });
 const err=a=>Math.abs(((a.gaze-a.toSgt)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI);
 ck(sa.posture==="standease" && sa.look0 && sa.L.every(a=>err(a)<0.01), `Stand at ease: all ${sa.L.length} soldiers' heads point at the drill sergeant (max error ${(Math.max(...sa.L.map(err))*57.3).toFixed(2)}°, head turn ${(Math.min(...sa.L.map(a=>Math.abs(a.rel)))*57.3).toFixed(0)}–${(Math.max(...sa.L.map(a=>Math.abs(a.rel)))*57.3).toFixed(0)}° off front)`);
 await shot('ease-1-stand-at-ease'); await zoom('ease-1-stand-at-ease-zoom');
 // tracks the DS if he moves
 const tr=await p.evaluate(()=>{ const S=FG.G.sgt, ox=S.x, oy=S.y; S.y-=3; const L=FG.look(); S.x=ox; S.y=oy; return L; });
 ck(tr.every(a=>err(a)<0.01 || Math.abs(a.rel)>=149*Math.PI/180), "heads track the drill sergeant when he moves");
 // At ease while at stand at ease: still no effect (look stays)
 const ae2=await p.evaluate(()=>{ const b0=FG.bang().n; FG.cmd("at ease"); FG.sim(1000); return {bang:FG.bang().n-b0, posture:FG.G.posture, look:FG.look().every(x=>x)}; });
 ck(ae2.bang===0 && ae2.posture==="standease" && ae2.look, "At ease during Stand at ease: no change (still looking), no '!'");
 // look ends on Parade rest, Attention, and any movement
 const ends=await p.evaluate(()=>{ const out={};
   FG.cmd("parade rest"); FG.sim(1500); out.parade=FG.look().every(x=>x===null) && FG.G.posture==="parade";
   FG.cmd("stand at ease"); FG.sim(1500); const again=FG.look().every(x=>x);
   FG.cmd("platoon attention"); FG.sim(1500); out.attn=again && FG.look().every(x=>x===null) && FG.G.posture==="attention";
   for(const t of ["right face","forward march","cover","dress right dress","at close interval march"]){
     FG.cmd("stand at ease"); FG.sim(1500); const on=FG.look().every(x=>x);
     FG.cmd(t); FG.sim(1500); out[t]=on && FG.look().every(x=>x===null);
     if(t==="forward march"){ FG.cmd("platoon halt"); FG.sim(2500); }
     if(t==="cover"||t==="at close interval march"){ FG.cmd("recover"); FG.sim(1200); }
     if(t==="dress right dress"){ FG.cmd("ready front"); FG.sim(1200); }
     if(t==="right face"){ FG.cmd("left face"); FG.sim(1500); }
   }
   if(FG.F.closeIv){ FG.cmd("normal interval march"); FG.sim(2600); }
   return out; });
 for(const [k,v] of Object.entries(ends)) ck(v, `look ends at ${k}`);
 // ---- Dress right: every file but the left raises the left arm; 4 facings
 const facing=[];
 for(let i=0;i<4;i++){
   const r=await p.evaluate(()=>{ FG.cmd("dress right dress"); FG.sim(1500); const A=FG.dressArms(); const res={W:FG.F.W, heading:FG.state().heading,
     left:A.filter(a=>a.q===0).every(a=>!a.arm), others:A.filter(a=>a.q!==0).every(a=>a.arm), right:A.filter(a=>a.q===FG.F.W-1).every(a=>a.arm), n:A.filter(a=>a.arm).length,
     side:A.filter(a=>a.arm).every(a=>a.side<0), gaps:A.filter(a=>a.arm).map(a=>a.gap)}; return res; });
   facing.push(r);
   if(i===0){ await shot('dress-1-north'); await zoom('dress-1-north-zoom'); }
   await p.evaluate(()=>{ FG.cmd("ready front"); FG.sim(1200); FG.cmd("right face"); FG.sim(1500); });
 }
 for(const r of facing) ck(r.left && r.others && r.right && r.n===12 && r.side && r.gaps.every(g=>g>0.05 && g<0.2),
   `Dress right facing ${r.heading}°: far-left file arms down, ${r.n} arms up incl. far-right file, pointing left, tiny gap ${Math.min(...r.gaps).toFixed(3)}–${Math.max(...r.gaps).toFixed(3)}`);
 // eyes right unchanged: all but the right file
 const ey=await p.evaluate(()=>{ FG.cmd("dress right dress"); FG.sim(1500); const ok=FG.G.dress; FG.cmd("ready front"); FG.sim(1200); return ok && !FG.G.dress; });
 ck(ey, "Ready front ends the dress");
 // Cover / close interval arm roles unchanged
 const cv=await p.evaluate(()=>{ FG.cmd("cover"); FG.sim(2600); const a=FG.arms().map(x=>x.arm); FG.cmd("recover"); FG.sim(1200); FG.cmd("at close interval march"); FG.sim(2600); const h=FG.arms().map(x=>x.arm); FG.cmd("recover"); FG.sim(1200);
   return {lat:a.filter(x=>x==="lat").length, fwd:a.filter(x=>x==="fwd").length, none:a.filter(x=>!x).length, hip:h.filter(x=>x==="hip").length}; });
 ck(cv.lat===3 && cv.fwd===12 && cv.none===1 && cv.hip===16, `Cover (3 lat/12 fwd/1 down) and At close interval (16 hips) unchanged`);
 ck(errs.length===0, "no page errors "+errs.join(" | "));
 console.log(fails? fails+" FAILED" : "ALL PASS");
 await b.close(); process.exit(fails?1:0);
})();
