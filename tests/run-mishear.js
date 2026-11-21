const puppeteer=require('puppeteer-core'), P=require('path'), T=require('./mishear.js');
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage(); await p.goto('file://'+P.resolve(__dirname,'../index.html'));
const out=await p.evaluate(T=>{ const r={}; for(const c of ["lenient","standard","strict"]){ FG.settings.clarity=c;
  r[c]={posFail:Object.entries(T.positive).map(([k,v])=>[k,v,FG.parse(k)]).filter(x=>x[1]!==x[2]),
        negFail:T.negative.map(k=>[k,FG.parse(k)]).filter(x=>x[1]!==null)}; } FG.settings.clarity="lenient"; return r; },T);
let bad=0;
for(const [c,v] of Object.entries(out)){
  console.log(`${c}: positives ${Object.keys(T.positive).length-v.posFail.length}/${Object.keys(T.positive).length}, negatives ignored ${T.negative.length-v.negFail.length}/${T.negative.length}`);
  if(c==="lenient"||process.argv.includes("-v")){ for(const f of v.posFail) console.log("   MISS",JSON.stringify(f)); for(const f of v.negFail) console.log("   FALSE",JSON.stringify(f)); }
  if(c==="lenient") bad=v.posFail.length+v.negFail.length;
}
await b.close(); process.exit(bad?1:0);})();
