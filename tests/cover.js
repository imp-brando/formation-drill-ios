// Disheveled fall-in, COVER / RECOVER (arms + alignment), and the drill sergeant's "!" error flash.
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 const shot=n=>p.screenshot({path:P.resolve(__dirname,'../shots/'+n+'.png')});
 const zoom=async n=>{ const c=await p.evaluate(()=>{ const r=cv.getBoundingClientRect(), f=r.width/cv.width, sol=FG.state().soldiers;
   const xs=sol.map(s=>s[0]), ys=sol.map(s=>s[1]); const S=FG.G.sgt; if(S){ xs.push(S.x); ys.push(S.y); }
   const x0=Math.min(...xs)-2, x1=Math.max(...xs)+2, y0=Math.min(...ys)-3, y1=Math.max(...ys)+2, X=x=>r.left+(view.ox+x*view.scale)*f, Y=y=>r.top+(view.oy+y*view.scale)*f;
   return {x:X(x0), y:Y(y0), width:X(x1)-X(x0), height:Y(y1)-Y(y0)}; });
   const full=P.resolve(__dirname,'../shots/'+n.replace('-zoom','')+'.png'), out=P.resolve(__dirname,'../shots/'+n+'.png');
   require('child_process').execFileSync('python3',['-c',`from PIL import Image; im=Image.open('${full}'); c=im.crop((${Math.round(c.x*2)},${Math.round(c.y*2)},${Math.round((c.x+c.width)*2)},${Math.round((c.y+c.height)*2)})); c.resize((c.width*3,c.height*3),Image.LANCZOS).save('${out}')`]); };
 // ---- parser
 const yes={cover:["cover","cuvver","cover up","covah","lover","brother","platoon cover","Cover!"],
            recover:["recover","recuvver","ree cover","recovah","re-cover","re cover","recovered","platoon recover"]};
 const no=["take cover","cover me","under cover","my brother","i love my lover","cover the windows","recover my password","discover"];
 const pr=await p.evaluate((y,n)=>({c:y.cover.map(t=>[t,FG.parse(t)]), r:y.recover.map(t=>[t,FG.parse(t)]), n:n.map(t=>[t,FG.parse(t)])}),yes,no);
 ck(pr.c.every(x=>x[1]==="cover"), "Cover sound-alikes: "+pr.c.map(x=>x[0]+"="+x[1]).join(", "));
 ck(pr.r.every(x=>x[1]==="recover"), "Recover sound-alikes: "+pr.r.map(x=>x[0]+"="+x[1]).join(", "));
 ck(pr.n.every(x=>x[1]!=="cover"&&x[1]!=="recover"), "chatter not taken as Cover/Recover: "+pr.n.map(x=>x[0]+"="+x[1]).join(", "));

 // ---- disheveled fall-in (snake)
 await p.evaluate(()=>{ window.__noWalls=false; FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none"; FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300); });
 const d=await p.evaluate(()=>{
  const v=FG.visual(), off=v.map(s=>Math.hypot(s.vx-s.x,s.vy-s.y));
  const xs=[...new Set(v.map(s=>Math.round(s.x*100)/100))].sort((a,b)=>a-b), ys=[...new Set(v.map(s=>Math.round(s.y*100)/100))].sort((a,b)=>a-b);
  return {phase:FG.phase(), n:v.length, minOff:Math.min(...off), maxOff:Math.max(...off), maxDf:Math.max(...v.map(s=>Math.abs(s.df)))*57.3, xs, ys, cv:FG.cover(), over:FG.G.over}; });
 ck(d.phase==="formed" && d.cv.sloppy && d.minOff>0.05 && d.maxOff<0.4, `after Fall in the formation is ragged: every soldier off his spot by ${d.minOff.toFixed(2)}–${d.maxOff.toFixed(2)} step, facing skew up to ${d.maxDf.toFixed(0)}°`);
 ck(d.xs.length===4 && d.ys.length===4 && d.xs.every((x,i)=>!i||Math.abs(x-d.xs[i-1]-1)<0.01) && d.ys.every((y,i)=>!i||Math.abs(y-d.ys[i-1]-1)<0.01), `true slots stay on the exact 4x4 grid (x ${d.xs.join(",")}; y ${d.ys.join(",")})`);
 await shot('cover-1-ragged'); await zoom('cover-1-ragged-zoom');
 // ragged march: no break, no score change, offsets breathe
 const m=await p.evaluate(()=>{
  FG.G.recruits.length=0; const s0=FG.G.score; FG.cmd("forward march"); const samples=[]; let over=false;
  for(let i=0;i<24;i++){ FG.sim(250); over=over||FG.G.over; const v=FG.visual(); samples.push(v.map(s=>Math.hypot(s.vx-s.x,s.vy-s.y))); }
  FG.cmd("column right march"); for(let i=0;i<20;i++){ FG.sim(250); over=over||FG.G.over; }
  const varies=samples[3].some((o,i)=>Math.abs(o-samples[15][i])>0.01);
  const still=samples.at(-1).every(o=>o>0.01);
  FG.cmd("platoon halt"); FG.sim(2500);
  return {over, score:FG.G.score-s0+(0), recruits:FG.G.recruits.length, varies, still, sloppy:FG.cover().sloppy, move:FG.G.move}; });
 ck(!m.over && m.still && m.varies && m.sloppy, `marching ragged: stays ragged (offsets bob), no formation broke (over=${m.over})`);
 await shot('cover-2-ragged-march');
 // Cover while marching is an error; at the halt it works
 const c=await p.evaluate(()=>{
  const out={};
  out.move=FG.G.move;
  const b0=FG.bang().n; FG.cmd("recover"); out.recoverErr=FG.bang().n===b0+1 && FG.bang().on && !FG.cover().cover;
  FG.sim(1100);
  FG.cmd("cover"); for(let i=0;i<40 && !FG.cover().cover;i++) FG.sim(16); FG.sim(400); out.adjusting=FG.cover().cover && !FG.cover().hold;
  FG.sim(1600); const v=FG.visual(); out.hold=FG.cover().hold; out.sloppy=FG.cover().sloppy;
  out.maxOff=Math.max(...v.map(s=>Math.hypot(s.vx-s.x,s.vy-s.y)+Math.abs(s.df)));
  out.arms=FG.arms().map(a=>a.arm);
  const b1=FG.bang().n, st=JSON.stringify(FG.state()); FG.cmd("forward march"); FG.sim(600);
  out.fwdErr=FG.bang().n===b1+1 && FG.G.move==="halt" && JSON.stringify(FG.state())===st;
  return out; });
 ck(c.move==="halt" && c.recoverErr, "RECOVER without COVER: '!' and nothing else");
 ck(c.adjusting && c.hold && !c.sloppy && c.maxOff===0, `COVER: soldiers shuffle into place, then exact (max visual offset ${c.maxOff})`);
 ck(c.arms.filter(a=>a==="lat").length===3 && c.arms.filter(a=>a==="fwd").length===12 && c.arms.filter(a=>!a).length===1, `COVER arms (left): 3 lateral, 12 forward, 1 down (${c.arms.join(",")})`);
 ck(c.fwdErr, "Forward MARCH while at COVER: '!' and no movement (call RECOVER first)");
 await shot('cover-3-arms-out'); await zoom('cover-3-arms-out-zoom');
 const r=await p.evaluate(()=>{ FG.sim(1100); FG.cmd("recover"); FG.sim(700); const v=FG.visual();
   return {cover:FG.cover().cover, arms:FG.arms().every(a=>!a.arm), exact:v.every(s=>s.vx===s.x&&s.vy===s.y&&s.df===0), posture:FG.G.posture}; });
 ck(!r.cover && r.arms && r.exact && r.posture==="attention", "RECOVER: arms down, at attention, formation exact "+JSON.stringify(r));
 await shot('cover-4-recovered'); await zoom('cover-4-recovered-zoom');
 // recruits join a covered formation cleanly
 const rc=await p.evaluate(()=>{ FG.addRecruit(); return FG.visual().every(s=>s.vx===s.x&&s.vy===s.y); });
 ck(rc, "recruit joining a fixed formation joins cleanly");
 const rs=await p.evaluate(()=>{ FG.cmd("fall in"); FG.sim(800); const sl=FG.cover().sloppy; FG.addRecruit(); const v=FG.visual(); return sl && Math.hypot(v.at(-1).vx-v.at(-1).x, v.at(-1).vy-v.at(-1).y)>0.05; });
 ck(rs, "recruit joining a ragged formation joins ragged");

 // ---- arm roles in all four facings (independent geometric expectation)
 const arms=await p.evaluate(()=>{
  FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none"; const out=[];
  const faces=[null,"right face","about face","right face"];   // 0, 90, 270, 0... -> build 0,90,270,180 below
  const seq=[["",0],["right face",90],["right face",180],["right face",270]];
  for(const [cmd,h] of seq){
    if(cmd){ FG.cmd(cmd); FG.sim(2500); }
    FG.cmd("cover"); FG.sim(2000);
    const a=FG.arms();
    // forward f and right r per facing (screen coords, y down)
    const f={0:s=>-s.y,90:s=>s.x,180:s=>s.y,270:s=>-s.x}[h], rt={0:s=>s.x,90:s=>s.y,180:s=>-s.x,270:s=>-s.y}[h];
    const maxF=Math.max(...a.map(f)), front=a.filter(s=>f(s)>maxF-0.5), farLeft=front.reduce((m,s)=>rt(s)<rt(m)?s:m);
    let ok=true; for(const s of a){ const want = s===farLeft? null : front.includes(s)? "lat" : "fwd"; if(s.arm!==want) ok=false; }
    const raised=a.filter(s=>s.arm), lat=raised.filter(s=>s.arm==="lat"), fwd=raised.filter(s=>s.arm==="fwd");
    const leftSide=lat.every(s=>s.side < -0.3 && Math.abs(s.ahead)<0.05) && fwd.every(s=>s.ahead>0.3 && s.side<0);   // lateral arms go LEFT; forward arms from the left shoulder
    const gaps=raised.map(s=>s.gap), minGap=Math.min(...gaps), maxGap=Math.max(...gaps);
    out.push({h, ok, leftSide, minGap:+minGap.toFixed(3), maxGap:+maxGap.toFixed(3), lat:a.filter(s=>s.arm==="lat").length, fwd:a.filter(s=>s.arm==="fwd").length, none:a.filter(s=>!s.arm).length, heading:Math.round(((a[0].face*57.2958)%360+360)%360)});
    FG.cmd("recover"); FG.sim(400);
  }
  return out; });
 await p.evaluate(()=>{ FG.startHeadless('snake'); FG.setRecOn(true); FG.settings.sens="none"; FG.G.recruits.length=0; FG.cmd("cover"); FG.sim(2200); });
 await shot('cover-6-arms-north'); await zoom('cover-6-arms-north-zoom');
 const sg=await p.evaluate(()=>{ const g=FG.arms().filter(a=>a.arm).map(a=>a.gap); return {n:g.length, min:Math.min(...g), max:Math.max(...g)}; });
 ck(sg.n===15 && sg.min>0.02 && sg.max<0.2, `snake field scale: ${sg.n} arms up, fingertip gap ${sg.min.toFixed(3)}–${sg.max.toFixed(3)} step`);
 for(const a of arms) ck(a.leftSide && a.minGap>0.02 && a.maxGap<0.2, `facing ${a.h}°: LEFT arms (lateral to the left, forward from the left shoulder); fingertip gap to the next man ${a.minGap}–${a.maxGap} step (never touching)`);
 for(const a of arms) ck(a.ok && a.lat===3 && a.fwd===12 && a.none===1 && Math.abs(((a.heading-a.h)%360+360)%360)<2, `facing ${a.h}°: front rank left arm out to the left side (${a.lat}), front-left corner man arm down (${a.none}), rear ranks arm forward (${a.fwd})`);

 // ---- error list: each shows '!' for ~1 s and changes nothing else
 const errsR=await p.evaluate(()=>{
  const res=[];
  const snap=()=>JSON.stringify([FG.G.move,FG.G.tempo,FG.G.over,FG.G.score,FG.G.posture,FG.G.busy,FG.F.mode,FG.cover()]);
  const tryErr=(label,fn)=>{ FG.sim(1100); window.__execLog=[]; const n0=FG.bang().n, s0=snap(); fn(); const on=FG.bang().on, n1=FG.bang().n; FG.sim(150); const s1=snap(); const on2=FG.bang().on; FG.sim(900); const off=!FG.bang().on;
    res.push({label, ok:n1===n0+1 && on && on2 && off && s0===s1 && window.__execLog.length===0}); };
  FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none"; FG.setExecMode("words");
  for(const t of ["platoon halt","change step march","rear march","right flank march","half step march","quick time march","recover"]) tryErr(t+" (at the halt)",()=>FG.cmd(t));
  FG.cmd("forward march"); FG.sim(1500);
  for(const t of ["forward march","left face","about face","cover","recover","dress right dress","fall in","parade rest","open ranks march"]) tryErr(t+" (marching)",()=>FG.cmd(t));
  FG.cmd("platoon halt"); FG.sim(2500);
  // no execution word / no prep (through the speech path)
  let slot=0; const say=(t,fin)=>{ const r=[{transcript:t,confidence:.9}]; r.isFinal=!!fin; const results=[]; for(let i=0;i<=slot;i++) results.push(r); FG.handleResult({resultIndex:slot++,results}); };
  tryErr('bare "march"',()=>say("march",true));
  tryErr('bare "halt"',()=>say("halt",true));
  { FG.sim(1100); const n0=FG.bang().n, s0=snap(); say("column left",true); FG.sim(2000); const early=FG.bang().n===n0; FG.sim(2000); const n1=FG.bang().n; const s1=snap();
    res.push({label:'"Column left…" with no MARCH (after 3.5 s)', ok: early && n1===n0+1 && FG.bang().on && s0===s1}); }
  // before Fall in
  FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none";
  for(const t of ["forward march","cover","platoon halt"]) tryErr(t+" (before Fall in)",()=>FG.cmd(t));
  // chatter: silent, no '!'
  FG.startHeadless('drill'); FG.setRecOn(true); FG.sim(1200); const nC=FG.bang().n;
  for(const t of ["hey how's it going","take cover","i'll be there in a minute","march madness is on","discover"]) { say(t,true); FG.sim(200); }
  res.push({label:"chatter (5 phrases incl. 'take cover', 'march madness is on'): no '!'", ok:FG.bang().n===nC});
  return res; });
 for(const e of errsR) ck(e.ok, "error '!': "+e.label);
 // inflection failure (Drill Sergeant level, meter on, flat delivery) also flashes '!'
 await p.reload(); await p.evaluate(()=>{ FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="ds"; FG.meter(true); FG.setExecMode("words");
   let slot=100; const n0=FG.bang().n; for(let i=0;i<60;i++){ FG.sim(25); FG.frame(-40,150); }
   const r=[{transcript:"forward march",confidence:.9}]; r.isFinal=true; const results=[]; for(let i=0;i<=slot;i++) results.push(r); FG.handleResult({resultIndex:slot,results}); window.__n0=n0; });
 await new Promise(r=>setTimeout(r,100)); await p.evaluate(()=>FG.sim(400)); await new Promise(r=>setTimeout(r,200));
 const inf=await p.evaluate(()=>({bang:FG.bang().n===window.__n0+1, move:FG.G.move, verdict:document.getElementById('verdict').textContent}));
 ck(inf.bang && inf.move==="halt", `inflection failure on Drill Sergeant level: '!' (verdict "${inf.verdict}")`);
 // screenshot of the '!'
 await p.evaluate(()=>{ FG.startHeadless('snake'); FG.setRecOn(true); FG.settings.sens="none"; FG.sim(500); FG.cmd("platoon halt"); FG.sim(200); });
 await shot('cover-5-error-bang'); await zoom('cover-5-error-bang-zoom');
 console.log("fails", fails, "errors", JSON.stringify(errs)); await b.close(); process.exit(fails?1:0);
})();
