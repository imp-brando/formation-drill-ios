// End-to-end with a fake SpeechRecognition: misheard commands are understood, chatter is ignored silently,
// the status line shows the correction, Train my voice learns aliases, and the matcher is fast enough.
const puppeteer=require('puppeteer-core'), P=require('path');
const src=require('fs').readFileSync(__dirname+'/mock-src.js','utf8');
const mock=eval("("+src.slice(src.indexOf('const mock=()=>{')+'const mock='.length, src.indexOf('async function page')).trim().replace(/;$/,'')+")");
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.evaluateOnNewDocument(mock); await p.goto('file://'+P.resolve(__dirname,'../index.html')+'?debug=1');
 await p.evaluate(()=>localStorage.clear()); await p.reload();
 let fails=0; const check=(ok,msg)=>{ console.log((ok?'PASS ':'FAIL ')+msg); if(!ok) fails++; };
 // speed of the matcher on non-commands (worst case: no exact hit)
 const ms=await p.evaluate(()=>{ const t=performance.now(); for(let i=0;i<50;i++){ FG.parse("i'm going to the store later today "+i); FG.parse("palm left much"); } return (performance.now()-t)/100; });
 check(ms<15, `matcher speed ${ms.toFixed(2)} ms per transcript`);
 // play: Drill mode, real UI path with the fake recogniser
 await p.select('#micMode','rec'); await p.click('[data-mode="drill"]'); await new Promise(r=>setTimeout(r,400));
 const say=async(t,f=true)=>{ await p.evaluate((t,f)=>{ const r=window.__srs[window.__srs.length-1]; r.emit([[t,f]]); r.end(); },t,f); await new Promise(r=>setTimeout(r,120)); };
 const st=()=>p.evaluate(()=>({status:document.getElementById('srStatus').textContent, heard:document.getElementById('heard').className+"|"+document.getElementById('heardTxt').textContent, verdict:document.getElementById('verdict').textContent, move:FG.G.move, over:FG.G.over}));
 await p.evaluate(()=>{ FG.settings.sens="none"; });
 // the game starts scattered: chatter and other commands do nothing, "fall in" (by voice) forms them up
 await say("forward march"); await new Promise(r=>setTimeout(r,700)); let s0=await p.evaluate(()=>({phase:FG.phase(), move:FG.G.move}));
 await say("call in"); let s1=await p.evaluate(()=>FG.phase());
 check(s0.phase==="scatter" && s0.move==="halt" && s1==="forming", `scattered start: "forward march" ignored (${s0.phase}/${s0.move}), voice "call in" = FALL IN -> ${s1}`);
 await p.evaluate(()=>FG.formNow()); await new Promise(r=>setTimeout(r,700));
 await say("fowahd harch"); await new Promise(r=>setTimeout(r,1500));
 let s=await st(); check(s.move==="forward" && /understood as FORWARD, MARCH \(sound-alike\)/.test(s.status), 'drill slur "fowahd harch" steps off: '+s.status);
 const v0=s.verdict;
 for(const chat of ["hey what's up","move over","left it there","march is cold"]){ await say(chat); }
 s=await st(); check(s.move==="forward" && !s.over && s.verdict===v0 && /ignored/.test(s.heard) && /faint/.test(s.heard), 'chatter ignored quietly: heard='+s.heard+' verdict unchanged='+(s.verdict===v0));
 await new Promise(r=>setTimeout(r,600));
 await say("palm left march"); await new Promise(r=>setTimeout(r,200));
 s=await st(); check(/understood as COLUMN LEFT, MARCH/.test(s.status), 'user example "palm left march": '+s.status);
 await new Promise(r=>setTimeout(r,900));
 await p.screenshot({path:P.resolve(__dirname,'../shots/status-understood-2line.png')});
 await new Promise(r=>setTimeout(r,900));
 await say("call him right march"); await new Promise(r=>setTimeout(r,200));
 s=await st(); check(/understood as COLUMN RIGHT, MARCH/.test(s.status), 'user example "call him right march": '+s.status);
 // Train my voice: learn a phrase the built-in matcher rejects
 await p.evaluate(()=>{ document.getElementById('btnQuit').click(); });
 await new Promise(r=>setTimeout(r,300));
 const before=await p.evaluate(()=>FG.parse("bottom left march"));
 await p.evaluate(()=>{ if(document.getElementById('start').classList.contains('on')===false){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id==='start')); } document.getElementById('btnTrain').click(); });
 await new Promise(r=>setTimeout(r,200));
 // take 1 of Forward, then skip to Column left and record twice through the real button + fake recogniser
 for(let i=0;i<2;i++) await p.click('#trainSkip');
 const rec=async(alts)=>{ await p.click('#trainRec'); await new Promise(r=>setTimeout(r,60)); await p.evaluate(alts=>{ const r=window.__srs[window.__srs.length-1]; const res=alts.map(t=>({transcript:t,confidence:.8})); res.isFinal=true; r.onresult({resultIndex:0,results:[res]}); },alts); await new Promise(r=>setTimeout(r,100)); };
 await rec(["bottom left march","column left march","bottom laughed march","column right march"]);
 await p.screenshot({path:P.resolve(__dirname,'../shots/train-my-voice.png')});
 await rec(["bottom left march","bottomless march"]);
 const after=await p.evaluate(()=>({parse:FG.parse("bottom left march"), aliases:FG.aliases(), stored:localStorage.getItem("formation.aliases")}));
 check(before===null && after.parse==="colL", `trained alias: "bottom left march" ${before} -> ${after.parse}; stored ${after.stored}`);
 check(!JSON.stringify(after.aliases).includes("column right"), 'conflicting guess ("column right march") not stored');
 await p.evaluate(()=>{ window.confirm=()=>true; }); await p.click('#trainReset');
 check(await p.evaluate(()=>FG.parse("bottom left march")===null && localStorage.getItem("formation.aliases")==="{}"), 'reset forgets learned phrases');
 await p.screenshot({path:P.resolve(__dirname,'../shots/train-my-voice-reset.png')});
 console.log('errors',errs); await b.close(); process.exit(fails||errs.length?1:0);
})();
