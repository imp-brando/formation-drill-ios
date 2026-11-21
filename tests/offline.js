// Service worker: after one online visit, the game loads with no network (field use), and online
// visits still fetch fresh (network first).
const puppeteer=require('puppeteer-core'), {spawn}=require('child_process'), P=require('path');
(async()=>{
 const srv=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:P.resolve(__dirname,'..'),stdio:'ignore'});
 await new Promise(r=>setTimeout(r,800));
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 let fails=0; const ck=(ok,m)=>{ console.log((ok?"PASS ":"FAIL ")+m); if(!ok) fails++; };
 try{
  const p=await b.newPage(); const url='http://localhost:8765/index.html';
  await p.goto(url,{waitUntil:'load'});
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.reload({waitUntil:'load'});
  const ctl=await p.evaluate(()=>!!navigator.serviceWorker.controller);
  ck(ctl, "service worker installed and controlling the page");
  // voiced cadences are disabled: their audio is never cached (even if something fetches it)
  await p.evaluate(async()=>{ try{ await (await fetch("audio/cadence/c130-q116.mp3")).arrayBuffer(); }catch(_){} });
  const cached=await p.evaluate(async()=>{ let n=0; for(const k of await caches.keys()){ const c=await caches.open(k); n+=(await c.keys()).filter(r=>/audio\/cadence/.test(r.url)).length; } return n; });
  ck(cached===0, `cadence audio is not cached by the service worker (${cached} entries)`);
  await p.setOfflineMode(true);
  await p.reload({waitUntil:'load'});
  const off=await p.evaluate(()=>({fg:!!window.FG, verdict:(document.getElementById('verdict')||{}).textContent}));
  ck(off.fg && /Fall in/.test(off.verdict||""), `offline reload: game loads from the cache (verdict "${off.verdict}")`);
  const root=await (async()=>{ await p.goto('http://localhost:8765/',{waitUntil:'load'}); return p.evaluate(()=>!!window.FG); })();
  ck(root, "offline: the site root also opens the game");
  await p.setOfflineMode(false);
 }catch(e){ ck(false, "error: "+e.message); }
 await b.close(); srv.kill(); console.log("fails", fails); process.exit(fails?1:0);
})();
