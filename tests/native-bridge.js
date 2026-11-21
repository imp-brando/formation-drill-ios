// iOS app bridge: with a mock window.FGNative the game uses the native voice path (one shared
// stream: FGN.frame meter + FGN.speech transcripts); without it nothing changes (plain browser).
const puppeteer=require('puppeteer-core'), P=require('path');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; }; const errs=[];
 // plain browser
 const pb=await b.newPage(); pb.on('pageerror',e=>errs.push(e.message)); await pb.goto('file://'+P.resolve(__dirname,'../index.html'));
 const plain=await pb.evaluate(()=>({native:typeof NATIVE!=="undefined" && NATIVE, fgn:!!window.FGN, cls:document.documentElement.classList.contains('native-app')}));
 ck(!plain.native && !plain.cls, "plain browser: native bridge off, Chrome speech path unchanged");
 // app (mock bridge)
 const p=await b.newPage(); p.on('pageerror',e=>errs.push(e.message));
 await p.evaluateOnNewDocument(()=>{ window.__nat={calls:[], grammar:null}; window.FGNative={ start(){__nat.calls.push('start');}, stop(){__nat.calls.push('stop');}, setGrammar(g){__nat.grammar=g;}, version(){return "test";} }; });
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 const g=await p.evaluate(()=>({native:NATIVE, grammar:JSON.parse(__nat.grammar||"[]"), coexist}));
 ck(g.native && g.coexist==="yes", "app: native bridge detected, mic shared (no handoff)");
 ck(["column left march","fall in","cover","recover","platoon halt","[unk]"].every(x=>g.grammar.includes(x)) && g.grammar.includes("march"), `grammar sent from the web side (${g.grammar.length} entries incl. single words and [unk])`);
 const r=await p.evaluate(async()=>{
  const out={};
  FG.startHeadless('snake',true); await resumeListening(); out.started=__nat.calls.includes('start'); out.micOK=micOK; out.recOn=recOn;
  FGN.state('listening'); out.status=document.getElementById('srStatus').textContent;
  for(let i=0;i<20;i++){ FG.sim(25); FGN.frame(-60,0,0); }
  FGN.speech("fall",false,[]); FG.sim(100); FGN.speech("fall in",true,[]); 
  await new Promise(r=>setTimeout(r,50)); FG.sim(300); out.phase=FG.phase();
  FG.formNow(); FG.sim(1200);
  const n0=FG.bang().n; FGN.speech("[unk] cover",true,["ten cover"]); await new Promise(r=>setTimeout(r,50)); FG.sim(800);
  out.takeCover = !FG.cover().cover && FG.bang().n===n0;
  FGN.speech("[unk]",true,[]); FG.sim(200); out.unkSilent=FG.bang().n===n0;
  FGN.speech("cover",true,[]); await new Promise(r=>setTimeout(r,50)); FG.sim(900); out.cover=FG.cover().cover;
  FG.sim(1500); FGN.speech("recover",true,[]); await new Promise(r=>setTimeout(r,50)); FG.sim(900); out.recovered=!FG.cover().cover;
  // voice burst from native frames: prep heard, quiet gap, sharp loud onset -> executes before the transcript
  FG.setExecMode("burst"); FG.G.recruits.length=0;
  FGN.speech("forward",false,[]); FGN.speech("forward",true,[]); await new Promise(r=>setTimeout(r,30));
  out.armed=FG.burst().armed && FG.burst().armed.src;
  for(let i=0;i<12;i++){ FG.sim(25); FGN.frame(-60,0,0); }
  for(let i=0;i<6;i++){ FG.sim(25); FGN.frame(-30,180,0); }
  out.burst=FG.burst().last && FG.burst().last.id;
  for(let i=0;i<8;i++){ FG.sim(25); FGN.frame(-60,0,0); }
  FG.sim(1200); out.move=FG.G.move;
  // game over stops the native mic
  __nat.calls.length=0; stopListening("test"); out.stopped=__nat.calls.includes('stop');
  return out; });
 ck(r.started && r.micOK && r.recOn && /on-device/.test(r.status), `start: native mic started, meter + recogniser on ("${r.status}")`);
 ck(r.phase==="forming", `native transcript "fall in" → FALL IN (phase ${r.phase})`);
 ck(r.takeCover && r.unkSilent, '"take cover" ([unk] cover) stays chatter: no COVER, no "!"; lone [unk] silent');
 ck(r.cover && r.recovered, "native COVER then RECOVER work");
 ck(r.armed==="shared" && r.burst==="forward" && r.move==="forward", `voice burst on the shared native stream: armed=${r.armed}, fired=${r.burst}, move=${r.move}`);
 ck(r.stopped, "stopListening (formation broke) stops the native mic");
 console.log("fails", fails, "errors", JSON.stringify(errs)); await b.close(); process.exit(fails?1:0);
})();
