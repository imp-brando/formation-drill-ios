// Frame-by-frame look at the drill sergeant during a rear march and a counter column (world trail in red).
const puppeteer=require('puppeteer-core'), P=require('path'), {execSync}=require('child_process');
const TAG=process.argv[2]||"after";
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2});
 await p.goto('file://'+P.resolve(__dirname,'../index.html'));
 for(const cmd of ["rear march","counter column march"]){
  const name=cmd.split(" ")[0], files=[];
  await p.evaluate(cmd=>{ window.__noWalls=true; FG.startHeadless('drill'); FG.setRecOn(true); FG.settings.sens="none";
    FG.sim(600); FG.cmd("forward march"); FG.sim(2400); window.__trace=[]; FG.cmd(cmd); },cmd);
  for(let i=0;i<8;i++){
   await p.evaluate(()=>{ for(let t=0;t<750;t+=25){ FG.sim(25); const s=FG.sgt(); window.__trace.push([s.x,s.y]); } });
   const f=`/tmp/sgtf-${name}-${i}.png`; await p.screenshot({path:f}); files.push(f);
  }
  require('fs').writeFileSync('/tmp/sgtf.py', "from PIL import Image\nfs="+JSON.stringify(files)+"\nims=[Image.open(f).crop((0,100,780,880)).resize((300,300)) for f in fs]\nW=Image.new('RGB',(1200,600),'white')\nfor i,im in enumerate(ims): W.paste(im,((i%4)*300,(i//4)*300))\nW.save('"+P.resolve(__dirname,'../shots')+"/sgt-frames-"+name+"-"+TAG+".png')\n");
  execSync('python3 /tmp/sgtf.py');
 }
 await b.close();
})();
