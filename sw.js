/* Formation Drill service worker: network first (edits go live immediately), cached copy when offline. */
const CACHE="formation-drill-ios-v1";
const CORE=["./","./index.html","./manifest.webmanifest","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener("activate", e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", e=>{
  const req=e.request; if(req.method!=="GET" || new URL(req.url).origin!==location.origin) return;
  if(new URL(req.url).pathname.includes("/audio/cadence/")) return;          // voiced cadences disabled: never cache their audio
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(), 4000);   // weak signal: fall back after 4 s
      const res=await fetch(req, {signal:ctl.signal, cache:"no-cache"}); clearTimeout(timer);
      if(res && res.ok) cache.put(req, res.clone());
      return res;
    }catch(_){
      const hit=await cache.match(req, {ignoreSearch:true}) || (req.mode==="navigate" && await cache.match("./index.html"));
      return hit || new Response("Offline and not cached yet", {status:503, headers:{"Content-Type":"text/plain"}});
    }
  })());
});
