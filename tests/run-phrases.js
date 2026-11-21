// usage: node tests/run-phrases.js  (needs puppeteer-core and Chrome; NODE_PATH=/tmp/pp/node_modules)
const puppeteer=require('puppeteer-core'), path=require('path');
const cases=require('./phrases.js');
(async()=>{
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
  const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.resolve(__dirname,'../index.html'));
  const bad=await p.evaluate(c=>Object.entries(c).map(([k,v])=>[k,v,FG.parse(k)]).filter(x=>x[1]!==x[2]),cases);
  const n=Object.keys(cases).length, neg=Object.values(cases).filter(v=>v===null).length;
  console.log(`phrases: ${n} (${n-neg} commands, ${neg} rejects), failures: ${bad.length}`);
  for(const x of bad) console.log('  FAIL', JSON.stringify(x[0]), 'expected', x[1], 'got', x[2]);
  console.log('errors:', errs); await b.close(); process.exit(bad.length||errs.length?1:0);
})();
