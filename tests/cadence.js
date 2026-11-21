// Voiced cadences: left-foot alignment at quick and double time, no gap, echo guard, ducking,
// resume after a command and after halt→march, shuffle without repeats, real sprite decode.
const puppeteer=require('puppeteer-core'), P=require('path'), http=require('http'), fs=require('fs');
const ROOT=P.resolve(__dirname,'..');
(async()=>{
 const srv=http.createServer((q,r)=>{ const f=P.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
   fs.readFile(f,(e,d)=>{ if(e){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':f.endsWith('.mp3')?'audio/mpeg':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d); }); }).listen(0);
 const port=srv.address().port;
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(`http://localhost:${port}/index.html`);
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };

 // ---- real sprites: decode in Chrome, length = halves × 4 steps (no encoder padding left in)
 const dec=await p.evaluate(async()=>{ const ac=new AudioContext(), out=[];
   for(const c of FormationCadences.all()) for(const [v,bpm] of [["q116",116],["q136",136],["d180",180]]){
     const a=await (await fetch(`audio/cadence/${c.id}-${v}.mp3`)).arrayBuffer(), buf=await ac.decodeAudioData(a);
     const want=2*c.lines.length*240/bpm, d=buf.getChannelData(0); let first=0; while(first<d.length && Math.abs(d[first])<0.01) first++;
     out.push({k:c.id+"-"+v, dur:buf.duration, want, lead:first/buf.sampleRate}); }
   return out; });
 ck(dec.length===24 && dec.every(x=>Math.abs(x.dur-x.want)<0.06), "all 24 sprites decode to halves×4 steps (±60 ms): "+dec.map(x=>x.k+" "+(x.dur-x.want).toFixed(3)).join(", "));
 ck(dec.every(x=>x.lead<0.06), "each sprite's first call starts on the strike (<60 ms lead-in): max "+Math.max(...dec.map(x=>x.lead)).toFixed(3)+" s");

 // ---- form up and march (headless, virtual clock)
 await p.evaluate(()=>{ FG.startHeadless('snake',true); FG.setRecOn(true); FG.settings.sens="none"; window.__noWalls=true;
   FG.cmd("fall in"); for(let i=0;i<80 && FG.phase()!=="formed";i++) FG.sim(250); FG.sim(300); FG.G.recruits.length=0;
   window.__audioReq=0; const of=window.fetch; window.fetch=(u,...a)=>{ if(/audio\/cadence/.test(String(u))) window.__audioReq++; return of(u,...a); }; });
 // ---- disabled by default (CADENCES_ENABLED=false): no UI, no help card, nothing loads or plays
 const dis=await p.evaluate(()=>{ FG.cad.log=[]; FG.cadStart(); FG.cmd("forward march"); FG.sim(6000); const r={en:FG.cadEnabled(), bar:getComputedStyle(document.getElementById("cadBar")).display, help:getComputedStyle(document.getElementById("cadHelp")).display,
   on:FG.cad.on, lines:FG.cad.log.length, req:window.__audioReq, echo:FG.cadEcho("c 130 rolling down the strip")}; FG.cmd("platoon halt"); FG.sim(4000); return r; });
 ck(!dis.en && dis.bar==="none" && dis.help==="none", "voiced cadences disabled: ♪ Cadences bar and help card hidden");
 ck(!dis.on && dis.lines===0 && dis.req===0 && dis.echo===false, `disabled: Start does nothing, no lines, no audio fetched (${dis.req}), echo guard dormant`);
 // ---- engine checks below run with the feature switched back on (kept working for re-enabling)
 await p.evaluate(()=>{ FG.cadEnable(true); FG.cad.dry=true; FG.cad.log=[]; FG.cadStart(); });
 const off=await p.evaluate(()=>{ FG.sim(3000); return FG.cad.log.length; });
 ck(off===0, "at the halt the cadence waits (no line scheduled)");
 await p.evaluate(()=>{ FG.cmd("forward march"); FG.sim(20000); });
 const chk=async(label)=>{ const L=await p.evaluate(()=>FG.cad.log.splice(0)); 
   const feet=L.every(e=>e.foot==="L"), steps=L.slice(1).every((e,i)=>e.k-L[i].k===4), gap=L.slice(1).map((e,i)=>e.t-L[i].end), alt=L.slice(1).every((e,i)=>e.half!==L[i].half);
   const fit=L.every(e=>Math.abs(e.rate-e.period*({q116:116,q136:136,d180:180}[e.v])/60000)<1e-9);
   ck(L.length>=6 && feet, `${label}: every line starts on a LEFT-foot strike (${L.length} half-lines, beats ${L.map(e=>e.k).join(",")})`);
   ck(steps && gap.every(g=>Math.abs(g)<1) && alt, `${label}: back-to-back, no gap (max |gap| ${Math.max(0,...gap.map(Math.abs)).toFixed(2)} ms), call→response→call`);
   ck(fit, `${label}: playbackRate fits each half to 4 steps (${[...new Set(L.map(e=>e.v+"@"+(60000/e.period).toFixed(0)+"bpm"))].join(", ")})`);
   return L; };
 const Lq=await chk("quick time");
 ck(Lq.every(e=>e.v==="q116"), "quick time ~112 bpm uses the 116 variant");
 // strike alignment: scheduled time = that beat's strike on the game clock
 const al=await p.evaluate(()=>{ const out=[]; const orig=FG.cad.log=[]; let ok=true;
   for(let i=0;i<600;i++){ FG.sim(16); const e=FG.cad.log[FG.cad.log.length-1]; if(e && !e.seen){ e.seen=true; out.push({k:e.k, t:e.t, nextT:FG.clock.nextT, ck:FG.clock.k}); } }
   return out; });
 ck(al.length>0 && al.every(a=>a.ck<=a.k), "each half is scheduled ahead of its strike (one beat of look-ahead)");

 // ---- echo guard (a test cadence whose lyric is a real command)
 const echo=await p.evaluate(()=>{ FormationCadences.registerPack({id:"t", tier:"test", cadences:[{id:"echo-test", title:"Echo", lines:[{c:"column right march", r:"platoon halt"},{c:"left right left", r:"left right left"}], license:"test", source:"test"}]});
   FG.cadStop(); FG.cad.log=[]; document.getElementById("cadSel").value="echo-test"; FG.cadStart();
   window.__slot=window.__slot||0; const ev=(t,fin)=>{ const r=[{transcript:t, confidence:.9}]; r.isFinal=fin; const res=[]; const i=window.__slot; for(let j=0;j<=i;j++) res[j]=r; FG.handleResult({resultIndex:i, results:res}); if(fin) window.__slot++; };
   let i=0; while(!FG.cad.play && i++<100) FG.sim(50);
   while(!(FG.cad.play && FG.cad.play.half===0 && FG.now()>=FG.cad.play.t0)) FG.sim(20);
   const h0=FG.state().heading, b0=FG.bang().n, ex0=(window.__execLog=[]).length;
   ev("column right march",false); ev("column right march",true); FG.sim(1500);
   const r1={turned:FG.state().heading!==h0||window.__execLog.length>0, bang:FG.bang().n-b0, heard:document.getElementById("heardTxt").textContent};
   while(!(FG.cad.play && FG.cad.play.half===1 && FG.now()>=FG.cad.play.t0)) FG.sim(20);
   ev("platoon halt",true); FG.sim(1500);
   const r2={move:FG.G.move, bang:FG.bang().n-b0};
   while(!(FG.cad.play && FG.cad.play.line===1 && FG.now()>=FG.cad.play.t0)) FG.sim(20);
   ev("left right left march",true); FG.sim(800);   // lyric + a stray execution word: no '!'
   const r3={bang:FG.bang().n-b0};
   // a different command spoken over the lyric is obeyed
   const e4=FG.cadEcho("left right left left flank march"), e5=FG.cadEcho("column left march left right left"); ev("left flank march",true); FG.sim(2500);
   const r4={exec:window.__execLog.map(e=>e.id), e4, e5};
   return {r1,r2,r3,r4}; });
 ck(!echo.r1.turned && echo.r1.bang===0 && /cadence/.test(echo.r1.heard), "echo guard: the DS line 'column right march' heard while playing → ignored, no '!' ("+echo.r1.heard+")");
 ck(echo.r2.move!=="halt" && echo.r2.move!=="closing" && echo.r2.bang===0, "echo guard: platoon response 'platoon halt' → ignored, still marching");
 ck(echo.r3.bang===0, "echo guard: 'left right left march' (lyric + stray exec word) → no '!'");
 ck(echo.r4.exec.includes("lflank"), "'left flank march' during the lyric 'left right left' still executes ("+echo.r4.exec.join(",")+")");
 ck(echo.r4.e4===false && echo.r4.e5===false, "echo guard never claims a transcript with a command outside the lyric (before or after it)");

 // ---- ducking
 const duck=await p.evaluate(()=>{ FG.cadStop(); document.getElementById("cadSel").value="c130"; FG.cadStart(); FG.cad.log=[];
   while(!(FG.cad.play && FG.now()>=FG.cad.play.t0)) FG.sim(20);
   FG.meter(true); FG.setFloor(-60); FG.cad.testOut=-30; let t=FG.now(); const fr=db=>{ t+=25; FG.frame(db); FG.sim(25); };
   for(let i=0;i<60;i++) fr(-42+Math.sin(i)*3);            // cadence bleed only (mic ≈ output −12 dB)
   const bleedOnly={ducked:FG.cad.ducked};
   for(let i=0;i<4;i++) fr(-28);                           // the player starts talking (+14 dB over the bleed)
   const talk={ducked:FG.cad.ducked, gain:FG.cad.gain? FG.cad.gain.gain.value:null};
   for(let i=0;i<90;i++) fr(-44);                          // quiet again → un-duck after the hold
   const after={ducked:FG.cad.ducked};
   // speech result (no meter) ducks too; chatter final un-ducks and the cadence keeps going
   FG.meter(false); const ev=(tx,fin)=>{ const r=[{transcript:tx, confidence:.9}]; r.isFinal=fin; const res=[]; const i=window.__slot; for(let j=0;j<=i;j++) res[j]=r; FG.handleResult({resultIndex:i, results:res}); if(fin) window.__slot++; };
   const n0=FG.cad.log.length; ev("hey what's up",false); const interim=FG.cad.ducked; ev("hey what's up with the weather",true); const fin=FG.cad.ducked;
   FG.sim(4000); const kept=FG.cad.log.length>n0;
   FG.cad.testOut=null; return {bleedOnly, talk, after, interim, fin, kept}; });
 ck(!duck.bleedOnly.ducked, "cadence bleed in the mic alone does not duck (learned speaker→mic coupling)");
 ck(duck.talk.ducked, "player's voice above the bleed → cadence ducks within ~75 ms");
 ck(!duck.after.ducked, "un-ducks after the player goes quiet");
 ck(duck.interim && !duck.fin && duck.kept, "speech result ducks; chatter (non-command) un-ducks and the cadence continues");

 // ---- resume after a command (same half-line, next left foot after the action step)
 const res=await p.evaluate(()=>{ FG.cad.log=[]; while(!(FG.cad.play && FG.cad.play.half===1 && FG.now()>FG.cad.play.t0+300)) FG.sim(20);
   const cut={line:FG.cad.play.line, half:FG.cad.play.half}; window.__execLog=[]; FG.cmd("column left march"); const n0=FG.cad.log.length, during=FG.cad.play;
   const pa=FG.G.pendingAction; FG.sim(6000); const L=FG.cad.log.slice(n0);
   return {cut, stopped:!during, first:L[0], actK:pa.actK, foot:L[0]&&FG.footOf(L[0].k)}; });
 ck(res.stopped && res.first && res.first.line===res.cut.line && res.first.half===res.cut.half, `command interrupts; resumes the same half-line (line ${res.cut.line+1}, ${res.cut.half?"response":"call"})`);
 ck(res.first && res.first.k>res.actK && res.foot==="L", `resumes after the action step (beat ${res.actK}) on a LEFT foot (beat ${res.first&&res.first.k})`);

 // ---- halt, then march: pause and resume from the same spot
 const hm=await p.evaluate(()=>{ FG.cad.log=[]; while(!(FG.cad.play && FG.cad.play.half===0 && FG.now()>FG.cad.play.t0+200)) FG.sim(20);
   const cut={line:FG.cad.play.line, half:FG.cad.play.half}; const n0=FG.cad.log.length; FG.cmd("platoon halt"); FG.sim(5000); const halted=FG.G.move, n=FG.cad.log.length-n0;
   FG.cmd("forward march"); FG.sim(5000); const L=FG.cad.log.slice(n0+n); return {cut, halted, silent:n===0, first:L[0], foot:L[0]&&FG.footOf(L[0].k)}; });
 ck(hm.halted==="halt" && hm.silent, "Platoon, HALT: cadence stops, no lines at the halt");
 ck(hm.first && hm.first.line===hm.cut.line && hm.first.half===hm.cut.half && hm.foot==="L", `Forward, MARCH: resumes the interrupted half-line (line ${hm.cut.line+1}) on a LEFT foot`);

 // ---- double time
 await p.evaluate(()=>{ FG.cmd("double time march"); FG.sim(4000); FG.cad.log=[]; FG.sim(16000); });
 const Ld=await chk("double time");
 ck(Ld.length && Ld.every(e=>e.v==="d180" && Math.abs(e.rate-1)<0.01), "double time uses the 180 variant at rate 1.0");
 await p.evaluate(()=>{ FG.cmd("quick time march"); FG.sim(4000); FG.G.score=150; FG.cad.log=[]; FG.sim(16000); });
 const Lf=await chk("fast quick time (score 150)");
 ck(Lf.length && Lf.every(e=>e.v==="q136"), "quick time ≥126 bpm uses the 136 variant");

 // ---- shuffle
 const sh=await p.evaluate(()=>{ FG.cad.shuffle=true; FG.cad.bag=[]; const seq=[FG.cad.item.id]; for(let i=0;i<60;i++){ const n=FG.cadNextItem(); seq.push(n.id); FG.cad.item=n; }
   const n=FormationCadences.all().length; let cover=true; for(let i=1;i+n<=seq.length;i+=n){ if(new Set(seq.slice(i,i+n)).size!==n) cover=false; }
   return {rep:seq.some((x,i)=>i&&x===seq[i-1]), cover, n}; });
 ck(!sh.rep && sh.cover, `shuffle: no cadence twice in a row; each round plays all ${sh.n}`);
 const shp=await p.evaluate(()=>{ FG.cadStop(); FG.cad.shuffle=true; document.getElementById("cadSel").value="up-in-the-morning"; FG.cadStart(); FG.cad.log=[]; FG.sim(40000);
   const L=FG.cad.log; const ids=[]; L.forEach(e=>{ if(ids[ids.length-1]!==e.id) ids.push(e.id); }); const g=L.slice(1).map((e,i)=>e.t-L[i].end);
   return {ids, maxGap:Math.max(...g.map(Math.abs)), feet:L.every(e=>e.foot==="L")}; });
 ck(shp.ids.length>=2 && shp.ids.every((x,i)=>!i||x!==shp.ids[i-1]) && shp.maxGap<1 && shp.feet, "shuffle while marching: next cadence follows with no gap, still on the left foot ("+shp.ids.join(" → ")+")");

 // ---- off by default, UI, lyrics kept out of the speech grammar
 const ui=await p.evaluate(()=>({ grammar:GRAMMAR_PHRASES.some(g=>/rolling|granny|airborne|mama/.test(g)), headphones:/headphone|earbud/i.test(document.body.innerHTML+document.getElementById("main").textContent) }));
 ck(!ui.grammar, "no lyric words added to the recogniser grammar");
 ck(!ui.headphones, "no headphone advice anywhere");
 const p2=await b.newPage(); await p2.goto(`http://localhost:${port}/index.html`); const def=await p2.evaluate(()=>({on:FG.cad.on, en:FG.cadEnabled(), bar:getComputedStyle(document.getElementById("cadBar")).display}));
 ck(!def.on && !def.en && def.bar==="none", "fresh page: voiced cadences disabled and hidden");
 ck(errs.length===0, "no page errors "+errs.join(" | "));
 await b.close(); srv.close();
 console.log(fails? `\n${fails} FAILED`:"\nALL PASS"); process.exit(fails?1:0);
})();
