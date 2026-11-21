// iOS / Safari edition on real WebKit (Playwright) at an iPhone viewport, served over http://localhost
// (service worker allowed). Checks the PWA bits, the no-speech message, and a full voice session with a
// mock Safari recogniser that behaves like iOS: short sessions, errors, a dead restart that needs a tap.
// Run: NODE_PATH=/tmp/pw/node_modules node tests/ios-webkit.js
const {webkit, devices}=require('playwright'), P=require('path'), http=require('http'), fs=require('fs');
const ROOT=P.resolve(__dirname,'..'), SHOTS=P.join(ROOT,'shots');
const src=fs.readFileSync(__dirname+'/mock-src.js','utf8');
const mock=eval("("+src.slice(src.indexOf('const mock=()=>{')+'const mock='.length, src.indexOf('async function page')).trim().replace(/;$/,'')+")");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const TYPES={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg'};
const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
  const fp=P.join(ROOT,f); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){ r.writeHead(404); return r.end(); }
  r.writeHead(200,{'Content-Type':TYPES[P.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(r); });
(async()=>{
 await new Promise(r=>srv.listen(0,r)); const URL=`http://localhost:${srv.address().port}/`;
 fs.mkdirSync(SHOTS,{recursive:true});
 const b=await webkit.launch(); const iphone=devices['iPhone 15'];
 console.log('WebKit', b.version(), '·', iphone.viewport.width+'x'+iphone.viewport.height, '@'+iphone.deviceScaleFactor+'x');

 // 1) Real WebKit, no mock: PWA head, offline worker, no-speech message
 {const ctx=await b.newContext({...iphone}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await wait(800);
  const h=await p.evaluate(async()=>({
    capable:!!document.querySelector('meta[name="apple-mobile-web-app-capable"][content="yes"]'),
    icon:document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    vp:document.querySelector('meta[name="viewport"]').content,
    pos:getComputedStyle(document.body).position, ta:getComputedStyle(document.documentElement).touchAction,
    ios:IS_IOS, handoff:HANDOFF, sr:!!(window.SpeechRecognition||window.webkitSpeechRecognition),
    noSR:document.getElementById('noSR').classList.contains('on'),
    sw:!!(navigator.serviceWorker && await Promise.race([navigator.serviceWorker.ready.then(()=>true), new Promise(r=>setTimeout(()=>r(false),4000))])),
  }));
  ok(h.capable && h.icon && h.manifest, `Add to Home Screen: apple-mobile-web-app-capable, apple-touch-icon (${h.icon}), manifest (${h.manifest})`);
  ok(/viewport-fit=cover/.test(h.vp) && /user-scalable=no/.test(h.vp), 'viewport: notch-aware (viewport-fit=cover), no pinch/double-tap zoom');
  ok(h.pos==='fixed' && /manipulation/.test(h.ta), `no rubber-band scroll (body ${h.pos}), touch-action ${h.ta}`);
  ok(h.ios && h.handoff, 'iPhone detected (short sessions, speech first, meter checked before sharing the mic)');
  for(const u of [h.icon, h.manifest, 'icons/icon-512.png']){ const r=await p.request.get(URL+u); ok(r.ok(), `serves ${u} (${r.status()})`); }
  const man=await (await p.request.get(URL+h.manifest)).json(); ok(man.display==='standalone' && man.icons.length>=2, 'manifest: standalone with icons');
  ok(h.sw, 'service worker registered and ready (offline copy)');
  ok(h.sr ? true : h.noSR, `no recogniser in this WebKit build → clear message shown (${h.sr?'has SR':'notice on'})`);
  await p.screenshot({path:P.join(SHOTS,'ios-1-start.png')});
  ok(!errs.length, 'no page errors (plain WebKit): '+errs.join(' | ')); await ctx.close(); }

 // 2) In-app browser (Instagram on iPhone): no recogniser → tells them to open Safari
 {const ctx=await b.newContext({...iphone, userAgent:iphone.userAgent+' Instagram 300.0'}); const p=await ctx.newPage();
  await p.addInitScript(()=>{ delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await p.goto(URL); const t=await p.textContent('#noSR');
  ok(/Open in Safari/.test(t), 'in-app browser: "Open in Safari" message: '+t.slice(0,90)+'…');
  await p.screenshot({path:P.join(SHOTS,'ios-2-in-app-browser.png')}); await ctx.close(); }

 // 3) Voice session with an iOS-like mock recogniser
 const ctx=await b.newContext({...iphone, permissions:[]}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(mock); await p.goto(URL); await p.evaluate(()=>localStorage.clear()); await p.reload();
 await p.selectOption('#sens','none');
 await p.tap('button[data-mode="drill"]'); await wait(400);
 const s0=await p.evaluate(()=>({n:__srs.length, cont:__srs.at(-1).continuous, interim:__srs.at(-1).interimResults, gum:__gum, micOK, pend:pendingProbe, ctx:actx&&actx.state}));
 ok(s0.n>=1 && s0.cont===false && s0.interim===true, `recognition started on the tap: short sessions (continuous=${s0.cont}), interimResults=${s0.interim}`);
 ok(s0.gum===0 && !s0.micOK && s0.pend, 'speech first: voice meter waits until a command is heard (iOS may not share the mic)');
 ok(s0.ctx==='running', 'AudioContext resumed by the tap: '+s0.ctx);
 const emit=(t,f)=>p.evaluate(([t,f])=>__srs.at(-1).emit([[t,f]]),[t,f]);
 const end=()=>p.evaluate(()=>__srs.at(-1).end());
 await emit('fall',false); await emit('fall in',true); await wait(300);
 ok(await p.evaluate(()=>FG.phase()!=='scatter'), 'FALL IN by voice forms them up: '+await p.evaluate(()=>FG.phase()));
 await end(); await wait(100);
 const n1=await p.evaluate(()=>__srs.length); ok(n1>s0.n, `session ended (iOS) → restarted at once (${s0.n}→${n1})`);
 await p.evaluate(()=>FG.formNow()); await wait(1200);
 await p.screenshot({path:P.join(SHOTS,'ios-3-fallen-in.png')});
 // meter check ran after the first command (mock gUM): either shared or dropped, never breaks speech
 const m=await p.evaluate(()=>({gum:__gum, constraints:JSON.stringify(window.__lastConstraints||null)}));
 ok(m.gum>=1, 'voice meter tried after speech proved to work; constraints Safari accepts: '+m.constraints);
 await emit('cover',true); await wait(900); ok(await p.evaluate(()=>FG.cover().cover), 'COVER'); await end(); await wait(60);
 await wait(1500); await emit('recover',true); await wait(900); ok(await p.evaluate(()=>!FG.cover().cover), 'RECOVER'); await end(); await wait(60);
 await emit('forward',false); await emit('forward march',true); await wait(1000);
 ok(await p.evaluate(()=>FG.state().move)==='forward', 'FORWARD, MARCH'); await end(); await wait(60);
 await p.screenshot({path:P.join(SHOTS,'ios-4-marching.png')});
 // iOS ends the session at the pause between prep and execution: the two halves still join
 await wait(2500); await emit('column left',true); await end(); await wait(80); await emit('march',true); await wait(900);
 ok(/Column left/i.test(await p.textContent('#verdict')), 'split session "column left" … "march" joins: '+await p.textContent('#verdict'));
 await end(); await wait(60);
 // bare execution word → "!" only
 await wait(2500); const bang0=await p.evaluate(()=>FG.bang().n); await emit('march',true); await wait(500);
 ok(await p.evaluate(()=>FG.bang().n)===bang0+1, '"MARCH" alone → "!" over the drill sergeant'); await end(); await wait(60);
 // chatter discarded silently
 const bang1=await p.evaluate(()=>FG.bang().n); await emit('what time is it',true); await wait(400);
 ok(await p.evaluate(()=>FG.bang().n)===bang1, 'chatter ignored silently'); await end(); await wait(60);
 await emit('platoon',false); await emit('platoon halt',true); await wait(1200);
 ok(await p.evaluate(()=>FG.state().move)==='halt', 'PLATOON, HALT');
 // routine errors restart; network backs off
 for(const er of ['no-speech','aborted']){ const n=await p.evaluate(()=>__srs.length);
   await p.evaluate(e=>{ const r=__srs.at(-1); r.onerror&&r.onerror({error:e}); r.end(); },er); await wait(120);
   ok(await p.evaluate(()=>__srs.length)>n, `"${er}" → restarted`); }
 {const n=await p.evaluate(()=>__srs.length); await wait(450);   // let the session age past the quick-fail window
  await p.evaluate(()=>{ const r=__srs.at(-1); r.onerror({error:'network'}); r.end(); }); await wait(200);
  const mid=await p.evaluate(()=>({n:__srs.length, st:document.getElementById('srStatus').textContent}));
  await wait(1700); const n2=await p.evaluate(()=>__srs.length);
  ok(mid.n===n && n2>n && /internet/.test(mid.st), `"network" → waits (backoff), explains, then retries: ${mid.st}`); }
 // dead restart (start never fires onstart, as when Safari drops the gesture) → "Tap to resume listening"
 await p.evaluate(()=>{ const P=window.webkitSpeechRecognition.prototype; window.__realStart=P.start; P.start=function(){ this.running=true; }; restartRec(); });
 await wait(5200);
 ok(await p.isVisible('#tapResume'), '"Tap to resume listening" appears when Safari stops restarting');
 await p.screenshot({path:P.join(SHOTS,'ios-5-tap-to-resume.png')});
 await p.evaluate(()=>{ window.webkitSpeechRecognition.prototype.start=window.__realStart; });
 const n3=await p.evaluate(()=>__srs.length); await p.tap('#tapResume'); await wait(200);
 ok(!(await p.isVisible('#tapResume')) && await p.evaluate(()=>__srs.length)>n3 && await p.evaluate(()=>recRunning), 'tap restarts listening and hides the button');
 // Siri/Dictation off → clear instruction, stops retrying
 await p.evaluate(()=>{ const r=__srs.at(-1); r.onerror({error:'service-not-allowed'}); r.end(); }); await wait(300);
 const st=await p.textContent('#srStatus'); ok(/Dictation/.test(st) && !(await p.evaluate(()=>recOn)), 'service-not-allowed → "turn on Siri and Dictation": '+st);
 ok(!errs.length, 'no page errors (voice session): '+errs.join(' | '));
 // landscape
 await p.setViewportSize({width:iphone.viewport.height, height:iphone.viewport.width}); await wait(400);
 await p.screenshot({path:P.join(SHOTS,'ios-6-landscape.png')});
 ok(await p.evaluate(()=>document.getElementById('field').getBoundingClientRect().height>100), 'landscape: field still visible');
 await b.close(); srv.close();
 console.log(fails?`${fails} FAILED`:'ALL PASS'); process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
