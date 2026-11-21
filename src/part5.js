
/* ======================================================================
   RENDERING
====================================================================== */
const cv=$("field"), ctx=cv.getContext("2d");
let view={scale:16, ox:0, oy:0};
const cam={x:0,y:0};
function resize(){
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.max(1,Math.round(r.width*dpr)); cv.height=Math.max(1,Math.round(r.height*dpr));
}
window.addEventListener("resize",resize);
function computeView(){
  const W=cv.width, H=cv.height;
  if(G.mode==="snake"){ const sc=Math.min(W/SNAKE_W, H/SNAKE_H); view={scale:sc, ox:(W-SNAKE_W*sc)/2, oy:(H-SNAKE_H*sc)/2}; return; }
  const sol=allSoldiers(); let cx=0,cy=0; sol.forEach(s=>{cx+=s.x;cy+=s.y;}); cx/=sol.length||1; cy/=sol.length||1;
  cam.x=lerp(cam.x,cx,.08); cam.y=lerp(cam.y,cy,.08);
  const sc=Math.min(W,H)/(G.mode==="practice"? 7 : 21);   // zoomed out: about 21 steps across a phone
  view={scale:sc, ox:W/2-cam.x*sc, oy:H/2-cam.y*sc};
}
function draw(phase){
  computeView();
  const W=cv.width, H=cv.height, sc=view.scale;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle=G.mode==="snake"?"#3b4220":"#9aa063"; ctx.fillRect(0,0,W,H);
  ctx.setTransform(sc,0,0,sc,view.ox,view.oy);
  ctx.lineWidth=1/sc;
  if(G.mode==="snake"){
    ctx.fillStyle="#9aa063"; ctx.fillRect(0,0,SNAKE_W,SNAKE_H);
    ctx.strokeStyle="rgba(0,0,0,.08)";
    for(let x=0;x<=SNAKE_W;x++){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,SNAKE_H); ctx.stroke(); }
    for(let y=0;y<=SNAKE_H;y++){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(SNAKE_W,y); ctx.stroke(); }
    ctx.strokeStyle="#c3b091"; ctx.lineWidth=0.18; ctx.strokeRect(0.09,0.09,SNAKE_W-.18,SNAKE_H-.18);
    for(const rc of G.recruits) drawRecruit(rc);
  } else {
    // open drill field: grid scrolls with the camera, every 5th line brighter
    const x0=-view.ox/sc, y0=-view.oy/sc, x1=x0+W/sc, y1=y0+H/sc;
    for(let x=Math.floor(x0);x<=x1;x++){ ctx.strokeStyle= x%5===0?"rgba(230,220,195,.22)":"rgba(0,0,0,.07)"; ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke(); }
    for(let y=Math.floor(y0);y<=y1;y++){ ctx.strokeStyle= y%5===0?"rgba(230,220,195,.22)":"rgba(0,0,0,.07)"; ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); }
  }
  for(let r=F.ranks.length-1;r>=0;r--) F.ranks[r].sol.forEach((s,sq)=>{ if(s) drawSoldier(s, phase, sq); });
  if(G.sgt && G.mode!=="practice") drawSergeant(G.sgt);
  if(G.sgt && G.mode!=="practice" && G.bangT && now()-G.bangT<BANG_MS){       // error "!" over the DS's head
    const S=G.sgt, u=(now()-G.bangT)/BANG_MS;
    ctx.setTransform(1,0,0,1,0,0);
    const px=S.x*sc+view.ox, R=Math.max(14, sc*0.75), py=S.y*sc+view.oy - Math.max(sc*0.6,12) - R*(1+0.15*Math.sin(u*Math.PI*6)*(1-u));
    ctx.globalAlpha = u>0.8 ? (1-u)/0.2 : 1;
    ctx.fillStyle="#ffd21f"; ctx.strokeStyle="#b00000"; ctx.lineWidth=Math.max(2,R*0.16);
    ctx.beginPath(); ctx.arc(px,py,R,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#c00000"; ctx.font=`900 ${Math.round(R*1.5)}px system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("!", px, py+R*0.06); ctx.textAlign="start"; ctx.textBaseline="alphabetic"; ctx.globalAlpha=1;
    ctx.setTransform(sc,0,0,sc,view.ox,view.oy);
  }
  if(G.phase && G.phase!=="formed"){                                   // on-field prompt before the formation exists
    ctx.setTransform(1,0,0,1,0,0);
    const txt = G.phase==="scatter" ? "Call: FALL IN" : (G.dressT ? "Settling in…" : "Falling in: DOUBLE TIME");
    const fs=Math.round(Math.min(W,H)*0.07); ctx.font=`bold ${fs}px system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
    const tw=ctx.measureText(txt).width, y=H*0.42;
    ctx.fillStyle="rgba(20,24,8,.72)"; ctx.fillRect(W/2-tw/2-fs*0.6, y-fs*0.85, tw+fs*1.2, fs*1.7);
    ctx.fillStyle="#ffd27a"; ctx.fillText(txt, W/2, y); ctx.textAlign="start"; ctx.textBaseline="alphabetic";
    ctx.setTransform(sc,0,0,sc,view.ox,view.oy);
  }
  if(window.__trace && window.__trace.length>1){                // test-only: drill sergeant path overlay
    ctx.strokeStyle="rgba(200,30,30,.85)"; ctx.lineWidth=0.09; ctx.beginPath();
    window.__trace.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke();
    ctx.fillStyle="rgba(200,30,30,.9)"; for(let i=0;i<window.__trace.length;i+=8){ const p=window.__trace[i]; ctx.beginPath(); ctx.arc(p[0],p[1],0.06,0,Math.PI*2); ctx.fill(); }
  }
}
/** The drill sergeant: larger, darker blouse, campaign hat (wide brim, Montana peak). Legs swing whenever he walks. */
function drawSergeant(S){
  const pre = G.phase && G.phase!=="formed";
  const full=G.tempo==="double"?1.2:1.0, amp=pre? clamp(S.spd,0,1.25) : clamp(S.spd/full,0,1.25);
  const ph=pre? (S.walkPh||0) : (S.phase||0), walking=amp>0.08, mark=!pre && !walking && marching() && G.move==="mark";
  const k=(G.mode==="snake"?1.4:1.25)*1.25;
  ctx.save(); ctx.translate(S.x,S.y); ctx.scale(k,k);
  drawBody(0,0,S.face, walking?amp:0, (walking||mark)?ph:0, "#2c3514","#0b0d03", {posture:"attention", lift: mark?1:0});
  const d=dirV(S.face);
  ctx.fillStyle="#b08a4f"; ctx.strokeStyle="#4a3416"; ctx.lineWidth=0.035;
  ctx.beginPath(); ctx.arc(0,0,0.27,0,Math.PI*2); ctx.fill(); ctx.stroke();          // brim
  ctx.fillStyle="#8a6a37"; ctx.beginPath(); ctx.arc(0,0,0.14,0,Math.PI*2); ctx.fill(); ctx.stroke();  // crown
  ctx.strokeStyle="#4a3416"; ctx.lineWidth=0.03; ctx.beginPath();                    // Montana-peak pinches
  for(const a of [45,135,225,315]){ const v=dirV(S.face+a*D2R); ctx.moveTo(v[0]*.04,v[1]*.04); ctx.lineTo(v[0]*.12,v[1]*.12); } ctx.stroke();
  ctx.fillStyle="#e6dcc3"; ctx.beginPath(); ctx.arc(d[0]*.21,d[1]*.21,0.05,0,Math.PI*2); ctx.fill();   // facing marker on the brim
  ctx.restore();
}
function drawRecruit(rc){
  const pulse=.5+.5*Math.sin((now()-rc.t)/250);
  ctx.fillStyle=`rgba(255,215,90,${.2+.25*pulse})`; ctx.beginPath(); ctx.arc(rc.x,rc.y,.5,0,Math.PI*2); ctx.fill();
  drawBody(rc.x,rc.y,rc.face,0,0,"#d9b04a","#6b4f12",{posture:"attention"});
}
/** A soldier: a helmet dot with two clearly visible legs and boots, swinging on the beat.
    Stride length = the soldier's real displacement, so pivot-file half steps are visibly short. */
function drawSoldier(s, phase, sq){
  const pre = G.phase && G.phase!=="formed" && !s.arrived;        // strolling / double-timing to his place
  if(pre) phase=s.walkPh||0;
  const full = G.tempo==="double"?1.2:1.0;
  const amp = pre ? clamp(s.spd,0,1.25) : clamp(s.spd/full, 0, 1.25);
  const halted = !pre && ((G.move==="halt" && F.mode!=="counter") || (G.phase && G.phase!=="formed"));
  const inPlace = !halted && marching() && amp<0.2;            // mark time, pivot, closing, waiting rank
  const rightFile = sq===F.W-1;   // DRESS RIGHT: every file but the LEFT one raises the arm; all but the right file turn heads right
  const k = G.mode==="snake" ? 1.4 : 1.25;                   // sprites scaled up within the step so legs stay readable on the bigger field
  const vo=visOff(s), shuf=halted && (s.shuffle || now()<(s.shuffleUntil||0));
  ctx.save(); ctx.translate(s.x+vo[0],s.y+vo[1]); ctx.scale(k,k);
  drawBody(0,0,s.face+vo[2], halted?0:amp, shuf? (now()/250+s.id*0.37)%2 : phase, "#3e4a1c","#151905", {
    arm: G.cover ? s.arm : null, armReach:s.armReach, hipIv:F.interval, k,
    posture:halted?G.posture:"attention", dress:G.dress && sq!==0, look:lookAtSgt(s,halted), eyes:(G.eyes||G.dress) && !(marching() && rightFile && G.eyes) && !(G.dress && rightFile),
    lift: shuf? 0.6 : inPlace? 1-amp/0.2 : 0 });
  ctx.restore();
}
/** STAND AT EASE: head and eyes on the drill sergeant (tracks him), as an angle off the soldier's facing. */
const LOOK_MAX=150*D2R;   // the DS is off the left flank, centred: front-rank men look back over the left shoulder (~110–130°)
function lookAtSgt(s, halted){
  if(!halted || G.posture!=="standease" || !G.sgt || (G.phase && G.phase!=="formed")) return null;
  const want=Math.atan2(G.sgt.x-s.x, -(G.sgt.y-s.y));
  const rel=((want-s.face)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI;
  return clamp(rel,-LOOK_MAX,LOOK_MAX);
}
/* COVER arm geometry (sprite units, before the sprite scale k): attaches at the left shoulder, ends in a
   hand; its fingertip stops ARM_GAP steps short of the neighbour's body (body radius BODY_R*k). */
const ARM_SH=0.15, ARM_HAND=0.06, BODY_R=0.165, ARM_GAP=0.14;   // ~0.1 step clear of his outline stroke
function armGeom(reach, k, kind){
  const R=BODY_R*k+ARM_GAP, sh=ARM_SH*k;
  // lateral: shoulder, fingertip and neighbour's centre are on one line; forward: the fingertip is off his
  // centre line by the shoulder offset, so it stops where it is R from his centre
  const tip = kind==="lat" ? reach-R-sh : reach-Math.sqrt(Math.max(0,R*R-sh*sh));
  return clamp(tip/k - ARM_HAND, 0.12, 0.62);
}
/* AT CLOSE INTERVAL arm (sprite units): RIGHT hand on the right hip, elbow out to the right. The elbow's
   outer edge (round cap, half the outline width) touches the left side of the man to the right with zero gap:
   |elbow - his centre| = (BODY_R + HIP_LW/2)·k, his centre being one interval to the right. */
const HIP_SH=0.12, HIP_LW=0.15, HIP_BACK=0.05, HIP_HAND=[0.16,-0.07];
function hipElbow(iv, k){
  const R=(BODY_R+HIP_LW/2)*k, b=HIP_BACK*k;
  return (iv - Math.sqrt(R*R-b*b))/k;          // elbow centre, lateral, sprite units
}
function drawBody(x,y,h,amp,phase,fill,stroke,opt){
  const d=dirV(h), n=nrmV(h);
  // phase = beats since the last LEFT strike (0..2): left boot forward at 0, right boot forward at 1
  const swing=Math.cos(Math.PI*phase), L=0.42*amp*swing;
  const lift=opt.lift||0, liftL=lift*Math.max(0,Math.sin(Math.PI*phase)), liftR=lift*Math.max(0,-Math.sin(Math.PI*phase));
  const spread=(opt.posture==="parade"||opt.posture==="standease"||opt.posture==="atease")? 0.21 : 0.12;
  const rest=amp<0.05? 0.22 : 0.04;   // boots peek out in front of the helmet even at the halt
  const legs=[[-spread, L+rest, liftL], [spread, -L+rest, liftR]];
  ctx.lineCap="round";
  for(const [lat,fwd,lf] of legs){
    const hx=x+n[0]*lat*.5, hy=y+n[1]*lat*.5;
    const fx=x+n[0]*lat+d[0]*(fwd+lf*.14), fy=y+n[1]*lat+d[1]*(fwd+lf*.14);
    ctx.strokeStyle="#1f1608"; ctx.lineWidth=0.16;
    ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(fx,fy); ctx.stroke();
    ctx.fillStyle= lf>0.3? "#8a6a3a" : "#120c05";       // a raised boot shows lighter (knee up)
    ctx.beginPath(); ctx.ellipse(fx+d[0]*.03,fy+d[1]*.03,0.085+lf*.03,0.125+lf*.03,h,0,Math.PI*2); ctx.fill();
  }
  if(opt.arm==="hip"){                                     // AT CLOSE INTERVAL: right hand on hip, elbow out right
    const e=hipElbow(opt.hipIv||1, opt.k||1);
    const pts=[[x+n[0]*HIP_SH, y+n[1]*HIP_SH], [x+n[0]*e-d[0]*HIP_BACK, y+n[1]*e-d[1]*HIP_BACK], [x+n[0]*HIP_HAND[0]+d[0]*HIP_HAND[1], y+n[1]*HIP_HAND[0]+d[1]*HIP_HAND[1]]];
    ctx.lineJoin="round";
    for(const [col,w] of [["#151905",HIP_LW],[fill,0.09]]){ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.stroke(); }
    ctx.fillStyle="#d9b98c"; ctx.beginPath(); ctx.arc(pts[2][0],pts[2][1],0.055,0,Math.PI*2); ctx.fill();   // hand on the hip
  } else if(opt.arm){                                      // COVER: LEFT arm out to the left side, or straight forward
    const g=armGeom(opt.armReach, opt.k||1, opt.arm), v= opt.arm==="lat" ? [-n[0],-n[1]] : d;
    const sx=x-n[0]*ARM_SH, sy=y-n[1]*ARM_SH, ex=sx+v[0]*g, ey=sy+v[1]*g;
    ctx.strokeStyle="#151905"; ctx.lineWidth=0.15; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.strokeStyle=fill; ctx.lineWidth=0.09; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.fillStyle="#d9b98c"; ctx.beginPath(); ctx.arc(ex,ey,ARM_HAND,0,Math.PI*2); ctx.fill();   // hand
  }
  if(opt.dress){                                           // DRESS RIGHT: left arm out to the left, a tiny gap short of the man on the left
    const g=armGeom(F.interval, opt.k||1, "lat"), sx=x-n[0]*ARM_SH, sy=y-n[1]*ARM_SH, ex=sx-n[0]*g, ey=sy-n[1]*g;
    ctx.strokeStyle="#151905"; ctx.lineWidth=0.15; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.strokeStyle=fill; ctx.lineWidth=0.09; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.fillStyle="#d9b98c"; ctx.beginPath(); ctx.arc(ex,ey,ARM_HAND,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=0.05;
  ctx.beginPath(); ctx.arc(x,y,0.165,0,Math.PI*2); ctx.fill(); ctx.stroke();
  if(opt.look!=null){                                      // STAND AT EASE: head turned to the drill sergeant (helmet dot only)
    const fd=dirV(h+opt.look);
    ctx.fillStyle="#e6dcc3"; ctx.beginPath(); ctx.arc(x+fd[0]*.11,y+fd[1]*.11,0.05,0,Math.PI*2); ctx.fill();
  } else {
    const fd=dirV(h + (opt.eyes? 45*D2R : 0));             // face marker: eyes right turns it 45°
    ctx.fillStyle="#e6dcc3"; ctx.beginPath(); ctx.arc(x+fd[0]*.11,y+fd[1]*.11,0.05,0,Math.PI*2); ctx.fill();
  }
  if(opt.posture && opt.posture!=="attention"){ ctx.fillStyle="#120c05"; ctx.beginPath(); ctx.arc(x-d[0]*.21,y-d[1]*.21,0.05,0,Math.PI*2); ctx.fill(); } // hands behind back
}

/* ---------- Meter: pitch dots + loudness bars; last command's prep (blue) and execution (green/red) ---------- */
const mv=$("meter"), mctx=mv.getContext("2d");
let lastAnalysis=null;
function drawMeter(){
  const W=mv.width, H=mv.height, t1=now(), span=4000, X=t=>W-(t1-t)/span*W;
  mctx.fillStyle="#1d2010"; mctx.fillRect(0,0,W,H);
  if(lastAnalysis && lastAnalysis.ex){
    for(const s of (lastAnalysis.prepSegs||[])){ mctx.fillStyle="rgba(120,160,220,.25)"; mctx.fillRect(X(s.t0),0,X(s.t1)-X(s.t0),H); }
    const e=lastAnalysis.ex; mctx.fillStyle=lastAnalysis.ok?"rgba(120,220,100,.32)":"rgba(240,110,90,.32)"; mctx.fillRect(X(e.t0),0,Math.max(2,X(e.t1)-X(e.t0)),H);
  }
  const th=voiceThresh(), dbY=db=>H-clamp((db+70)/60,0,1)*H;
  mctx.strokeStyle="rgba(230,220,195,.35)"; mctx.setLineDash([3,3]); mctx.beginPath(); mctx.moveTo(0,dbY(th)); mctx.lineTo(W,dbY(th)); mctx.stroke(); mctx.setLineDash([]);
  for(const f of frames){ if(f.t<t1-span) continue; mctx.fillStyle=f.db>th?"#c3b091":"#4a5230"; mctx.fillRect(X(f.t),dbY(f.db),W/160,H-dbY(f.db)); }
  for(const f of frames){ if(f.t<t1-span||!f.hz) continue; const y=H-clamp(Math.log2(f.hz/70)/Math.log2(450/70),0,1)*H; mctx.fillStyle="#ff9d3a"; mctx.fillRect(X(f.t)-1.5,y-1.5,3,3); }
  mctx.fillStyle="rgba(230,220,195,.75)"; mctx.font="10px system-ui"; mctx.fillText("pitch ●   volume ▮   prep ▭ blue · exec ▭ green/red", 4, 11);
  if(!micOK){ mctx.fillStyle="#ffd27a"; mctx.font="12px system-ui"; mctx.fillText(meterOffReason||"Voice meter off", 4, H/2); mctx.font="10px system-ui"; mctx.fillText("Commands still work. Inflection isn't checked.", 4, H/2+15); }
  // measured vs needed for the last command (transparency)
  if(lastAnalysis && lastAnalysis.checks && lastAnalysis.checks.length){
    mctx.fillStyle="rgba(12,14,5,.88)"; mctx.fillRect(0,H-32,W,32);   // readable backdrop for the values
    mctx.font="bold 11px system-ui"; let x=4, y=H-19;
    const lbl=SENS[settings.sens].label+(settings.sens==="ds"?" (all):":" ("+lastAnalysis.need+" of 3):")+" ";
    mctx.fillStyle="rgba(230,220,195,.9)"; mctx.fillText(lbl, x, y); x+=mctx.measureText(lbl).width;
    for(const c of lastAnalysis.checks){
      const g=c.got===null||c.got===undefined? "n/a" : c.unit==="ms"? Math.round(c.got)+"ms" : (c.key==="pitch"?Math.abs(c.got):c.got).toFixed(1)+c.unit;
      const s=`${c.pass?"✓":"✗"} ${c.name} ${g} / ${c.max?"≤":"≥"}${c.need}   `, w=mctx.measureText(s).width;
      if(x+w>W && y<H-10){ x=4; y=H-5; }                     // wrap onto a second row
      mctx.fillStyle=c.pass?"#9be37f":"#ff9d8a"; mctx.fillText(s, x, y); x+=w;
    }
  } else { mctx.fillStyle="rgba(230,220,195,.6)"; mctx.font="10px system-ui"; mctx.fillText("Level: "+SENS[settings.sens].label, W-110, 11); }
}

/* ======================================================================
   SPEECH RECOGNITION + MIC SHARING
   Android Chrome often starves SpeechRecognition when a getUserMedia stream
   (our voice meter) is open at the same time. Mic modes:
     auto: desktop/iOS run both. On Android, speech starts ALONE; the meter is
           only tried after speech is proven to work, and is dropped if it
           stops recognition from delivering results. The outcome is saved.
     rec:  speech recognition only (no voice meter; commands always accepted)
     both: force both (for phones that can share the mic)
====================================================================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_ANDROID = /Android/i.test(navigator.userAgent);
/* iOS / Safari edition. Safari's webkitSpeechRecognition (iOS 14.5+) goes through Siri's servers, ends
   sessions quickly, is unreliable in continuous mode, needs a tap to start the first time, and is missing
   entirely in other iPhone browsers and in apps' built-in browsers. iPhones are treated like the other
   short-session phones: short sessions restarted at once, speech first, and the voice meter only added
   after a check shows the two can share the mic (otherwise commands are judged without the meter). */
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|Line\/|GSA\/|Twitter|LinkedInApp|Snapchat|MicroMessenger|GmailApp|CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
const HANDOFF = IS_ANDROID || IS_IOS;   // phones where speech and the meter may not share the mic
let recFails=0, recBackoff=0, recStartPending=0;
let rec=null, recOn=false, recRunning=false, session=0, lastCmdT=-Infinity, ttsBusy=false, ttsQuietSince=-Infinity;
let sessionText="", lastRecStart=0, lastResultT=0, ptt=false, restartTimer=null, watchdogTimer=null, lastRecError="";
let micMode = ["auto","rec","both"].includes(localStorage.getItem("formation.micMode")) ? localStorage.getItem("formation.micMode") : "auto";
let coexist = localStorage.getItem("formation.coexist");   // "yes" | "no" | null (untested)
let meterOffReason = "", pendingProbe=false, probe=null;
const normText = t => t.toLowerCase().replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ").trim();
let statusHoldUntil=0;   // keep "Heard … → understood as …" readable across Android's constant session restarts
function setStatus(txt, cls, hold){ const el=$("srStatus"); if(!el) return; if(!hold && now()<statusHoldUntil && cls==="ok") return; el.textContent=txt; el.className=cls||""; statusHoldUntil = hold ? now()+hold : 0; }

/* Grammar hint: Chrome mostly ignores it, but it's harmless and helps engines that use it. */
const GRAMMAR_PHRASES=["column right march","column left march","column half right march","column half left march","counter column march","rear march","right flank march","left flank march","forward march","mark time march","half step march","change step march","double time march","quick time march","right step march","left step march","backward march","open ranks march","close ranks march","extend march","close march","at close interval march","normal interval march","at normal interval march","platoon halt","platoon attention","right face","left face","about face","parade rest","stand at ease","at ease","dress right dress","eyes right","ready front","fall in","fall out","one step to the right march","two steps to the right march","three steps to the right march","four steps to the right march","one step to the left march","two steps to the left march","three steps to the left march","four steps to the left march"];
function addGrammar(r){
  try{
    const GL=window.SpeechGrammarList||window.webkitSpeechGrammarList; if(!GL) return;
    const g=new GL(); g.addFromString("#JSGF V1.0; grammar drill; public <cmd> = "+GRAMMAR_PHRASES.join(" | ")+" ;", 1);
    r.grammars=g;
  }catch(_){}
}
function makeRec(){
  const r=new SR();
  r.lang="en-US"; r.interimResults=true; r.maxAlternatives=8;
  // Android: short sessions restarted immediately are the most reliable. Hold-to-talk stays open
  // until release, so a pause before the execution word can't end it.
  r.continuous = ptt || !HANDOFF;
  addGrammar(r);
  r.onstart=()=>{ session++; sessionText=""; recRunning=true; lastRecStart=now(); lastRecError=""; recStartPending=0; hideTapResume();
    setStatus(ptt? "🎙 Listening (hold)…" : "🎙 Listening"+(micOK?" · voice meter on":" · speech only"), "ok"); };
  r.onresult=handleResult;
  r.onerror=e=>{
    lastRecError=e.error;
    if(e.error==="service-not-allowed" && IS_IOS){ recOn=false; setStatus("Speech recognition is off on this iPhone. Turn on Siri and Dictation (Settings → General → Keyboard → Enable Dictation), then reload.","bad"); flash("TURN ON DICTATION","bad","Settings → General → Keyboard → Enable Dictation, and turn on Siri. Then reload this page."); return; }
    if(e.error==="not-allowed" && IS_IOS && recFails<1 && everStarted){ recFails++; showTapResume(); return; }   // iOS wants a fresh tap
    if(e.error==="not-allowed"||e.error==="service-not-allowed"){ recOn=false; setStatus("Speech recognition blocked ("+e.error+"). "+(IS_IOS?"Allow the microphone and speech recognition for this site (aA → Website Settings → Microphone → Allow), then reload.":"Allow the microphone for this site in your browser settings, then reload."),"bad"); flash("SPEECH RECOGNITION BLOCKED","bad","Allow microphone access for this site, then reload."); return; }
    if(e.error==="audio-capture" && micOK && HANDOFF && micMode!=="both"){ disableMeter("Voice meter off: this phone can't share the mic with speech recognition"); return; }
    if(e.error==="network"){ recBackoff=Math.min(8000, (recBackoff||750)*2); setStatus("Speech recognition needs an internet connection"+(IS_IOS?" (Safari sends speech to Apple)":"")+". Retrying…","bad"); }
    // "no-speech" and "aborted" are routine; onend restarts
  };
  r.onend=()=>{
    const quick = now()-lastRecStart<400;                         // ended almost at once: count it as a failure
    recRunning=false;
    if(lastRecError!=="network") recBackoff = quick ? (++recFails>=4 ? Math.min(3000, 250*recFails) : 0) : (recFails=0, 0);
    if(IS_IOS && recFails>=8){ showTapResume(); return; }          // stuck in a fail loop: a tap restarts it cleanly
    if(recOn && !ptt) scheduleRestart(recBackoff);                  // no gap when healthy
  };
  return r;
}
function startRecognition(){
  if(!SR){ setStatus(noSRText(),"bad"); return false; }
  recOn=true; recFails=0; recBackoff=0; restartRec();
  clearInterval(watchdogTimer); watchdogTimer=setInterval(()=>{
    if(!recOn || ptt || burstHold) return;
    // iOS: a restart that never reaches onstart usually needs a tap (Safari dropped the gesture)
    if(IS_IOS && recStartPending && now()-recStartPending>3500){ recStartPending=0; showTapResume(); return; }
    if(!recRunning && now()-lastRecStart>2500 && !tapResumeShown) restartRec();
  }, 1500);
  return true;
}
function restartRec(){
  try{ if(rec){ rec.onend=null; rec.abort(); } }catch(_){}
  recRunning=false; rec=makeRec();
  try{ rec.start(); lastRecStart=now(); recStartPending=recStartPending||now(); everStarted=true; }
  catch(_){ if(IS_IOS && ++recFails>=3) showTapResume(); else scheduleRestart(250); }
}
let everStarted=false, tapResumeShown=false;
/** Why there's no speech recognition, for this device. */
function noSRText(){
  if(IS_IOS && IN_APP_BROWSER) return "Speech recognition isn't available in this app's built-in browser. Open the page in Safari.";
  if(IS_IOS) return "Speech recognition isn't available. Use Safari on iOS 14.5+ with Siri and Dictation turned on.";
  return "Speech recognition isn't supported in this browser. Use Safari on iPhone or iPad (iOS 14.5+), or Chrome.";
}
function showTapResume(){ if(!recOn) return; tapResumeShown=true; const b=$("tapResume"); if(b) b.classList.add("on"); setStatus("🎙 Listening paused by Safari. Tap \"Tap to resume listening\".","warn"); }
function hideTapResume(){ tapResumeShown=false; const b=$("tapResume"); if(b) b.classList.remove("on"); }
function scheduleRestart(ms){ clearTimeout(restartTimer); restartTimer=setTimeout(()=>{ if(recOn && !recRunning && !ptt && !burstHold) restartRec(); }, ms); }

let pendingPrep=null;                 // {text, t}: a prep heard without its execution word yet
const consumedText=new Map();          // result key -> transcript already turned into a command
const PREP_WAIT_MS=3500;
function freshPart(key, n){
  const prev=consumedText.get(key);
  if(prev!==undefined){
    if(n.startsWith(prev)) return n.slice(prev.length).trim();
    const pw=prev.split(" "), nw=n.split(" ");
    if(pw[0]!==nw[0]) return n;          // a different utterance reusing the slot: parse all of it
    // the recogniser revised words it already gave us: only take words beyond what we used
    return nw.length>pw.length+1 ? nw.slice(pw.length).join(" ") : "";
  }
  // Android Chrome repeats earlier words of the session in later results
  // (only when the new result is longer; saying the same command again is a new command)
  return sessionText && n.length>sessionText.length && n.startsWith(sessionText+" ") ? n.slice(sessionText.length).trim() : n;
}
function hasExecWord(t){ return normalizeSpeech(t).split(" ").slice(-3).some(w=>execClassesOf(w)); }
function handleResult(e){
  if(!recOn) return;                    // game over / menu: ignore anything still in flight
  lastResultT=now();
  if(probe) probe.results++;
  let triggerProbe=false;
  for(let i=e.resultIndex;i<e.results.length;i++){
    const res=e.results[i], key=session+":"+i, top=res[0].transcript.trim();
    $("heardTxt").textContent=top; $("heard").className="";
    if(cadEcho(top)){ $("heard").className="faint"; $("heardTxt").textContent="(cadence) "+top; consumedText.set(key, normText(top)); continue; } // never obey the cadence voice
    if(cad.on) cadDuck();                                // the player is talking: duck the cadence
    let hit=null, firstFresh=null;
    const pend = pendingPrep && now()-pendingPrep.t<PREP_WAIT_MS ? pendingPrep.text : null;
    // score every alternative Chrome offers (alone, then joined to a prep heard just before); keep the best
    for(let pass=0; pass<2 && !hit; pass++){
      if(pass===1 && !pend) break;
      for(let a=0;a<res.length;a++){
        const n=normText(res[a].transcript), fresh=freshPart(key,n);
        if(firstFresh===null) firstFresh=fresh;
        if(!fresh) continue;
        const p=parseCommand(pass===0? fresh : pend+" "+fresh);
        if(p && (!hit || p.score>hit.p.score+1e-9)) hit={p, raw:(pass===0?"":pend+" … ")+res[a].transcript.trim(), n};
      }
    }
    if(burstTranscript(hit&&hit.p.cmd, hit? hit.raw : firstFresh, res.isFinal)){ consumedText.set(key, normText(res[0].transcript)); sessionText=normText(res[0].transcript); continue; }
    if(hit){
      consumedText.set(key, hit.n); sessionText=hit.n; pendingPrep=null; if(armed) disarm("command");
      $("heardTxt").textContent=hit.raw; $("heard").className="";
      const how = hit.p.via==="sound-alike" ? " (sound-alike)" : hit.p.via==="your voice" ? " (your voice)" : "";
      setStatus(`Heard "${hit.raw}" → understood as ${hit.p.cmd.name.toUpperCase()}${how}`, "ok", 4000);
      onCommandHeard(hit.p, hit.raw); triggerProbe=true;
    } else if(!res.isFinal && firstFresh && sharedMic()){
      const prep=parsePrepOnly(firstFresh) || (settings.clarity!=="exact" && fuzzyPrepOnly(firstFresh));
      if(prep && armBurst(prep, top, false)) picaaPrep();
    } else if(res.isFinal && firstFresh){
      triggerProbe=true;
      const prep=parsePrepOnly(firstFresh) || (settings.clarity!=="exact" && fuzzyPrepOnly(firstFresh));
      if(prep){
        const pp={text:firstFresh, t:now()}; pendingPrep=pp; picaaPrep(); armBurst(prep, top, true);
        later(PREP_WAIT_MS+250, ()=>{ if(pendingPrep===pp && lastCmdT<pp.t){ pendingPrep=null; dsError(`No command of execution after "${prep.name.split(",")[0]}"`); } });
        setStatus(`Heard "${top}" → understood as ${prep.name.split(",")[0].toUpperCase()}… waiting for ${prep.exec}`, "ok", 3500);
      } else if(isBareExec(firstFresh)){
        // an execution word with no preparatory command ("MARCH!", "HALT!"): a drill error, not chatter
        $("heard").className="faint"; $("heardTxt").textContent=top;
        dsError(`"${top}" with no preparatory command`);
      } else {
        // not a drill command: discard quietly (no flash, no penalty)
        $("heard").className="faint"; $("heardTxt").textContent=top+" (ignored)"; cadUnduck();
      }
      consumedText.set(key, normText(res[0].transcript));
    }
  }
  // Speech is proven to work: now try adding the voice meter (after this utterance is handled)
  if(pendingProbe && triggerProbe) setTimeout(startProbeAfterSpeech, 300);
}

/** Only execution word(s), nothing else: "march", "harch", "halt", "face", "hut"... */
function isBareExec(text){
  const w=String(text).toLowerCase().replace(/[^a-z ]/g,"").trim().split(/\s+/).filter(Boolean);
  return w.length>0 && w.length<=2 && w.every(x=>/^(?:march|marche|harch|hutch|hut|halt|hault|holt|face|faced|haas)$/.test(x));
}
/* ---------- Game over: stop listening completely (mic indicator off) until the user taps ---------- */
function stopListening(why){
  armed=null; burstHold=false;
  recOn=false; ptt=false; pendingPrep=null; pendingProbe=false; probe=null;
  clearTimeout(restartTimer); clearInterval(watchdogTimer);
  try{ if(rec){ rec.onend=null; rec.onresult=null; rec.abort(); } }catch(_){}
  rec=null; recRunning=false;
  const hadMeter=micOK; stopMic();
  if(hadMeter && HANDOFF && coexist!=="yes") pendingProbe=false;
  meterOffReason="Mic off";
  setStatus(why||"🎙 Mic off. Tap FALL IN to resume.", "warn");
}
async function resumeListening(){
  if(micMode!=="rec" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) await setupMeter();
  startRecognition();
}

/* ---------- Voice meter (getUserMedia) setup and the Android coexistence probe ---------- */
async function setupMeter(){
  if(micOK) return;
  if(micMode==="rec"){ meterOffReason="Voice meter off (speech-only mode)"; return; }
  if(micMode==="both" || !HANDOFF || coexist==="yes"){ await startMic(); return; }
  if(coexist==="no"){ meterOffReason="Voice meter off: this phone can't share the mic with speech recognition"; return; }
  meterOffReason="Voice meter starts after your first command is heard";   // Android, untested: speech first
  pendingProbe=true;
}
async function startProbeAfterSpeech(){
  pendingProbe=false;
  const ok=await startMic();
  if(!ok){ meterOffReason="Voice meter unavailable"; return; }
  meterOffReason="";
  probe={t0:now(), results:0, firstVoice:0};
  setStatus("Checking whether the voice meter and speech recognition can share the mic… say a command","warn");
  setTimeout(checkProbe, 500);
}
function checkProbe(){
  if(!probe || !micOK) return;
  const t=now(), voiced=frames.filter(f=>f.t>probe.t0 && f.rel>VOICE_REL);
  if(voiced.length && !probe.firstVoice) probe.firstVoice=voiced[0].t;
  if(probe.results>0 && voiced.length>=4){          // both delivered: they coexist
    coexist="yes"; localStorage.setItem("formation.coexist","yes"); probe=null;
    setStatus("🎙 Listening · voice meter on (shares the mic fine)","ok"); return;
  }
  if(probe.firstVoice && voiced.length>=20 && t-probe.firstVoice>4000 && probe.results===0)
    return disableMeter("Voice meter off: it was blocking speech recognition on this phone");
  if(probe.results>=2 && voiced.length===0 && t-probe.t0>6000)
    return disableMeter("Voice meter off: this phone mutes it while recognising speech");
  if(t-probe.t0>30000 && probe.results===0 && !probe.firstVoice){ probe.t0=t; }   // nobody spoke yet, keep waiting
  setTimeout(checkProbe, 500);
}
function disableMeter(reason){
  stopMic(); probe=null; pendingProbe=false; meterOffReason=reason;
  coexist="no"; localStorage.setItem("formation.coexist","no");
  restartRec();
  setStatus("🎙 Listening · speech only. "+reason+". Commands are accepted without the voice check.","warn");
}

/* ---------- Hold-to-talk backup: forces a fresh recognition session while held ---------- */
function pttDown(e){
  if(e) e.preventDefault();
  if(!SR || !G || G.over) return;      // mic stays off after Formation broke until FALL IN is tapped
  ptt=true; recOn=true; clearTimeout(restartTimer);
  try{ if(rec){ rec.onend=null; rec.abort(); } }catch(_){}
  rec=makeRec(); rec.onend=()=>{ recRunning=false; if(!ptt) scheduleRestart(40); };
  try{ rec.start(); }catch(_){}
  $("pttBtn").classList.add("held");
}
function pttUp(){
  if(!ptt) return;
  ptt=false; $("pttBtn").classList.remove("held");
  try{ if(rec) rec.stop(); }catch(_){}           // stop() delivers the final result, then onend resumes auto-listening
  scheduleRestart(1200);
}

/** A command was parsed: wait for the voice to stop, then judge inflection, foot, and state. */
function onCommandHeard(p, raw){
  const heardAt=now();
  if(heardAt-lastCmdT<600) return; lastCmdT=heardAt;
  const poll=()=>{
    if(micOK && now()-lastLoudT<120 && now()-heardAt<250) return setTimeout(poll,30); // let the execution word finish (max 250 ms)
    judge(p, raw, heardAt, false);
  };
  poll();
}
/** A drill command that's wrong for the moment: a "!" over the drill sergeant for 1 s. Nothing else
    changes (no score, no movement, no game over); the status line can say why. */
const BANG_MS=1000;
function dsError(why){
  if(!G || G.mode==="practice") return;
  G.bangT=now(); G.bangN=(G.bangN||0)+1; if(typeof cadUnduck==="function") cadUnduck();   // not executed: cadence carries on
  if(why) $("detail").textContent=why;
}
function judge(p, raw, heardAt, typed){
  const c=p.cmd, S=SENS[settings.sens];
  // AT EASE: deliberately no effect at all (no posture change, no "!")
  if(c.id==="atease"){ lastAnalysis={ok:true, detail:"At ease: no effect"}; return; }
  // No formation yet: only FALL IN counts (a one-part call here, no inflection check); every other
  // command is ignored with a quiet hint.
  if(G.phase && G.phase!=="formed" && G.mode!=="practice"){
    if(c.id==="fallin" && G.phase==="scatter"){ lastAnalysis={ok:true,detail:"Fall in"}; startFallIn(); return; }
    dsError(G.phase==="scatter" ? "Call FALL IN to form up" : "Falling in… wait until they're formed");
    return;
  }
  const a = c.single? {ok:true, detail:"One-part command (no inflection needed)"} : typed? {ok:true, detail:"Typed (debug): inflection skipped"} : analyseInflection(c, heardAt);
  lastAnalysis=a;
  if(G.mode==="practice"){ reportVerdict(c,a,footCheck(c,a)); return; }
  if(!a.ok){ dsError(); return reportVerdict(c,a); }
  const why=canExecute(c);
  if(why){ if(!G.over) dsError(); return reportVerdict(c,{ok:false,reason:"Can't execute",detail:why}); }
  const fc=footCheck(c,a);
  if(fc && fc.wrong && S.foot==="reject") return reportVerdict(c,{ok:false,reason:"Wrong foot",detail:`Call it as the ${fc.want==="L"?"left":"right"} foot strikes`,ex:a.ex,prepSegs:a.prepSegs}, fc);
  // Executed on the next beat; foot-specific commands wait for the correct foot while marching.
  // PICAA: anchor the command of execution to the foot strike it was called on, then one additional
  // step, then the action step. If it wasn't on the correct foot, use the next correct-foot strike.
  const kE=anchorBeat(c, a, heardAt, p);
  const tag = p.tag || null;
  const run=()=>{ if(tag&&tag.cancelled) return; schedTag=tag; try{ if(!canExecute(c) || c.id==="fallin") execute(c, kE); } finally{ schedTag=null; } if(tag) tag.ran=true; };
  if(kE<clock.k) run(); else at(kE, run, tag);
  reportVerdict(c, a, fc);
}
/* When was the command of execution actually spoken? From the voice meter if it's on, otherwise
   the recognition time minus Chrome's typical interim-result delay. */
const EST_REC_LAT=250;
function anchorBeat(c, a, heardAt, p){
  if(!marching() || G.move==="mark") return clock.k;                 // from the halt / mark time: next strike
  const spokenT = (p && p.onsetT!==undefined) ? p.onsetT : (a && a.ex && a.ex.peakT) ? a.ex.peakT : heardAt-EST_REC_LAT;
  const kS = footAtTime(spokenT).k;
  if(c.foot==="L"||c.foot==="R"){
    if(footOf(kS)===c.foot && kS>=clock.k-1) return kS;              // called on the correct foot
    return nextBeat(c.foot);                                          // otherwise: next correct-foot strike
  }
  return Math.max(kS, clock.k-1);                                     // either foot: the strike it was called on
}
function footCheck(c,a){
  if(!(c.foot==="L"||c.foot==="R") || !(marching()||G.mode==="practice") || !a || !a.ex) return null;
  const f=footAtTime(a.ex.peakT);
  return {want:c.foot, got:f.foot, wrong:f.foot!==c.foot};
}
function reportVerdict(c,a,fc){
  const el=$("verdict");
  if(a.ok){
    const wrong = fc && fc.wrong && SENS[settings.sens].foot!=="ignore";
    el.className = (wrong||a.warn) ? "warn" : "ok";
    el.textContent = (wrong? "WRONG FOOT (accepted): " : "ACCEPTED: ") + c.name;
    $("detail").textContent = (wrong?`Call it as the ${fc.want==="L"?"left":"right"} foot strikes. `:"") + (a.warn||a.detail||"");
    chime(true);
  } else {
    el.className="bad"; el.textContent = a.reason.toUpperCase()+": "+c.name;
    $("detail").textContent = (a.hint? a.hint+" " : "") + (a.detail||""); chime(false);
  }
}
/* ======================================================================
   OPTION A: VOICE-BURST EXECUTION TIMING
   Chrome recognises the preparatory command ("Column left…") during the natural pause. The game
   then ARMS and the command of execution is the first sharp loudness burst on the local voice meter:
   no waiting for Chrome to turn "MARCH" into text. PICAA is anchored to the burst onset.
   Guards: a prep first; a quiet gap (>=150 ms) after it; a rise >=12 dB above the noise floor;
   >=50 ms sustained (a click doesn't count); inside the 3.5 s window. Chrome's later transcript only
   confirms (no double execution) or cancels ("as you were", or no execution word) if the action
   step hasn't happened yet.
   Mic: if the meter and recognition can share the mic (desktop, or an Android phone that passed the
   sharing check) both run. Otherwise on Android the game SWITCHES: Android ends the recognition
   session at the pause after the prep, so the meter takes the mic for the execution word, then hands
   it back. If the meter never hears anything twice in a row, the game falls back to words only.
====================================================================== */
const laterQ=[]; function later(ms,fn){ laterQ.push({t:now()+ms,fn}); }
function runLater(t){ for(let i=0;i<laterQ.length;i++) if(laterQ[i].t<=t){ const f=laterQ.splice(i--,1)[0]; f.fn(); } }
let execMode = ["burst","words"].includes(localStorage.getItem("formation.execMode")) ? localStorage.getItem("formation.execMode") : "burst";
const BURST={gapMs:150, riseDb:12, confirmMs:50, windowMs:PREP_WAIT_MS, confirmWindowMs:2500};
let armed=null, lastBurst=null, burstHold=false, switchMisses=0, schedTag=null;
function burstAvailable(){ return execMode==="burst" && micMode!=="rec" && !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia) && !G.over && G.mode!=="practice"; }
function sharedMic(){ return micOK && (!HANDOFF || coexist==="yes" || micMode==="both"); }
/** A prep was recognised: arm for the voice burst. isFinal: Chrome finished the result (the session has paused). */
async function armBurst(cmd, prepText, isFinal){
  if(window.__armLog) window.__armLog.push({t:Math.round(now()), id:cmd.id, avail:burstAvailable(), shared:sharedMic(), isFinal, micOK, armed:!!armed, hold:burstHold});
  if(!burstAvailable() || cmd.single) return false;
  if(armed && armed.cmd===cmd) return true;
  const t=now();
  if(sharedMic()){
    armed={cmd, prepText, t, src:"shared", quietSince: now()-lastLoudT>=BURST.gapMs ? lastLoudT : null, on:null};
  } else if(HANDOFF && isFinal){
    // switch the mic over to the meter for the execution word
    burstHold=true; clearTimeout(restartTimer);
    try{ if(rec){ rec.onend=null; rec.abort(); } }catch(_){}
    recRunning=false;
    armed={cmd, prepText, t, src:"switch", quietSince:t-BURST.gapMs, on:null, heard:0};   // Chrome only ends the session after silence
    const ok = micOK || await startMic();
    if(!ok || !armed){ endSwitch(); armed=null; return false; }
    armed.meterT=now();
  } else return false;
  const a=armed; later(BURST.windowMs, ()=>{ if(armed===a){ disarm("window"); } });
  setStatus(`Heard "${prepText}" → understood as ${cmd.name.split(",")[0].toUpperCase()}… call ${cmd.exec} (voice burst${armed.src==="switch"?", mic switched":""})`, "ok", BURST.windowMs);
  return true;
}
function disarm(why){
  if(window.__armLog) window.__armLog.push({disarm:why, had:!!armed, t:Math.round(now())});
  const a=armed; armed=null; if(!a) return;
  if(a.src==="switch"){
    if(why==="window" && !a.heard){ if(++switchMisses>=2){ execMode="words"; setStatus("Voice burst off: this phone gives the meter no sound while switching. Using words only.","warn",4000); } }
    endSwitch();
  }
}
function endSwitch(){ if(!burstHold) return; burstHold=false; if(!(coexist==="yes")) stopMic(); if(recOn) restartRec(); }
/** Called for every meter frame (~25 ms). */
function burstCheck(f){
  const a=armed; if(!a || f.t<a.t-400) return;
  const loud = f.rel>VOICE_REL;
  if(a.src==="switch" && f.rel>3) a.heard++;
  if(!loud){
    if(a.on){ a.on=null; }                                    // a blip, not a word
    if(a.quietSince===null) a.quietSince=f.t;
    return;
  }
  if(a.quietSince===null || f.t-a.quietSince<BURST.gapMs){ a.quietSince=null; return; }   // still talking: no gap yet
  if(!a.on) a.on={t0:f.t, peak:f.rel};
  a.on.peak=Math.max(a.on.peak, f.rel);
  if(f.t-a.on.t0>=BURST.confirmMs && a.on.peak>=BURST.riseDb) fireBurst(a, a.on.t0);
}
function fireBurst(a, t0){
  if(window.__armLog) window.__armLog.push({fire:a.cmd.id, t:Math.round(now())});
  armed=null; switchMisses=0;
  const tag={cancelled:false, ran:false};
  const p={cmd:a.cmd, prep:a.prepText, onsetT:t0, via:"voice burst", tag, score:1};
  lastBurst={id:a.cmd.id, t:now(), onsetT:t0, tag, prepText:a.prepText, src:a.src};
  lastCmdT=now(); pendingPrep = pendingPrep || {text:a.prepText, t:now()};   // so "march" alone can confirm
  if(window.__burstLog) window.__burstLog.push({id:a.cmd.id, onsetT:t0, firedT:now()});
  // judge on the opening of the execution word (inflection needs a little of it), anchored to the onset
  later(Math.max(0, t0+160-now()), ()=>{ if(!tag.cancelled) judge(p, a.prepText+" … (voice burst)", now(), false); });
  setStatus(`Heard "${a.prepText}" + voice burst → ${a.cmd.name.toUpperCase()}`, "ok", 4000);
  if(a.src==="switch") watchSwitchEnd();
}
function watchSwitchEnd(){ const t0=now(); const chk=()=>{ if(now()-lastLoudT>200 || now()-t0>1200) endSwitch(); else later(50,chk); }; later(120,chk); }
/** Cancel a burst-triggered command if its action step hasn't happened yet. */
function cancelBurst(reason){
  const b=lastBurst; if(!b || b.tag.cancelled) return false;
  const pa=G.pendingAction;
  if(b.tag.ran && pa && pa.actT) return false;              // too late: the action step already happened
  b.tag.cancelled=true; G.sched=G.sched.filter(x=>x.tag!==b.tag);
  if(b.tag.ran){
    if(b.tag.pathLen!==undefined && F.path.segs.length>b.tag.pathLen){ F.path.segs.length=b.tag.pathLen; F._fi=null; }
    G.busy=null; G.pendingAction=null;
  }
  picaaSet(["","","","",""]); lastBurst=null;
  flash("AS YOU WERE","warn",reason); setStatus("Cancelled: "+reason, "warn", 3000);
  return true;
}
/** Chrome's transcript after a burst: confirm, or cancel. Returns true if the result was handled. */
function burstTranscript(hitCmd, fresh, isFinal){
  const b=lastBurst; if(!b || now()-b.t>BURST.confirmWindowMs) return false;
  const n=normalizeSpeech(fresh||"");
  if(/\bas you were\b/.test(n)) return cancelBurst('Heard "as you were"'), true;
  if(hitCmd){ if(hitCmd.id===b.id){ setStatus(`Confirmed by speech: "${fresh}" → ${hitCmd.name.toUpperCase()}`, "ok", 3000); lastBurst=null; pendingPrep=null; return true; } return false; }
  if(!isFinal || !n) return false;
  const prepEcho = parsePrepOnly(n) || fuzzyPrepOnly(n);
  if(prepEcho && prepEcho.id===b.id) return true;            // Chrome caught up on the prep: nothing new
  if(!hasExecWord(n)){ cancelBurst(`Speech heard "${fresh}", not ${b.id==="halt"?"HALT":"an execution word"}`); return true; }
  return false;
}
/* ---------- PICAA beat indicator: Prep · Interval · Command · Additional step · Action step ---------- */
function picaaSet(st){ const el=$("picaa"); if(!el) return; [...el.querySelectorAll("b")].forEach((sp,i)=>sp.className=st[i]||""); el.classList.toggle("show", st.some(Boolean)); }
function picaaPrep(){ picaaSet(["on","wait","","",""]); }
function picaaExec(c,kE,addl){
  if(c.single) return;
  const st=["on","on","on", addl?"":"skip", ""]; picaaSet(st);
  const light=(i,kk)=>{ const f=()=>{ st[i]="on"; picaaSet(st); }; if(kk<clock.k) f(); else at(kk,f); };
  if(addl){ light(3,kE); light(4,kE+1); } else light(4,kE);
  at((addl?kE+1:kE)+2, ()=>picaaSet(["","","","",""]));
}
function flash(msg,cls,detail){ const el=$("verdict"); el.className=cls; el.textContent=msg; $("detail").textContent=detail||""; }

/* ======================================================================
   VOICED CADENCES: the DS calls each line, the platoon sounds off (repeat after me).
   Pre-generated sprites, audio/cadence/<id>-<variant>.mp3 (tools/gen_cadence.py): half-line i
   (call = 2·line, response = 2·line+1) fills exactly 4 steps at the variant's tempo, with no gap.
   Each half starts on a LEFT-foot strike, scheduled on the Web Audio clock one beat ahead, and
   playbackRate stretches it to the current step period (quick time 112–144, double time 180).
   Mic: echo guard (anything matching the lines just played is ignored), duck while the player
   talks, interrupt on a command and pick up the same half-line on a later left foot once the
   command has executed (or once marching restarts after a halt).
====================================================================== */
/** Voiced cadences are OFF until better (real) recordings replace the TTS sprites: no UI, no audio fetched or cached.
    Flip to true (and drop new sprites into audio/cadence/) to bring the feature back; the engine, echo guard and
    ducking below stay intact but dormant (cad.on is never true while disabled). */
let CADENCES_ENABLED=false;
const CAD_VARIANTS={q116:116, q136:136, d180:180};
const CAD_DUCK=0.15, CAD_ECHO_MS=2500, CAD_BLEED_MARGIN=8, CAD_UNDUCK_MS=1800;
const cad={ on:false, item:null, line:0, half:0, play:null, hist:[], bufs:{}, loading:{}, gain:null, an:null, anBuf:null,
  shuffle:localStorage.getItem("formation.cadShuffle")==="1", vol:+(localStorage.getItem("formation.cadVol")??0.8),
  lyrics:localStorage.getItem("formation.cadLyrics")!=="0", bag:[], ducked:false, lastTalk:-Infinity, waitPA:null, waiting:false,
  cpl:[], outHist:[], voiceRun:0, lastVoiceF:-Infinity, testOut:null, dry:false, log:null };
const cadById=id=>FormationCadences.all().find(c=>c.id===id);
function fillCadences(){
  const sel=$("cadSel"), keep=sel.value; sel.innerHTML="";
  for(const c of FormationCadences.all()){ const o=document.createElement("option"); o.value=c.id; o.textContent=c.title+(c.tempo==="double"?" (double time)":""); sel.appendChild(o); }
  if(keep && cadById(keep)) sel.value=keep;
  if(!cad.on){ cad.item=cadById(sel.value)||FormationCadences.all()[0]; cad.line=0; cad.half=0; }
  renderCad();
}
document.addEventListener("cadencepacks", fillCadences);
function cadVariant(){ return G && G.tempo==="double" ? "d180" : bpm()<126 ? "q116" : "q136"; }
function cadGraph(){
  ensureAudio(); if(!actx || cad.gain) return;
  cad.gain=actx.createGain(); cad.gain.gain.value=cad.vol;
  cad.an=actx.createAnalyser(); cad.an.fftSize=1024; cad.anBuf=new Float32Array(cad.an.fftSize);
  cad.gain.connect(cad.an); cad.an.connect(actx.destination);
}
function cadLoad(item){
  if(!CADENCES_ENABLED || !item || !actx) return;
  for(const v of Object.keys(CAD_VARIANTS)){
    const key=item.id+"-"+v; if(cad.bufs[key] || cad.loading[key]) continue;
    cad.loading[key]=fetch("audio/cadence/"+key+".mp3").then(r=>{ if(!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(a=>new Promise((ok,no)=>actx.decodeAudioData(a,ok,no))).then(b=>{ cad.bufs[key]=b; renderCad(); })
      .catch(()=>{ delete cad.loading[key]; cad.failed=true; renderCad(); });
  }
}
/** Fetch every sprite once so the service worker has them for offline use. */
function cadPrefetchAll(){ if(!CADENCES_ENABLED) return; for(const c of FormationCadences.all()) for(const v of Object.keys(CAD_VARIANTS)) fetch("audio/cadence/"+c.id+"-"+v+".mp3").catch(()=>{}); }
const cadReady=item=>cad.dry || Object.keys(CAD_VARIANTS).every(v=>cad.bufs[item.id+"-"+v]);
function cadStart(){
  if(!CADENCES_ENABLED) return;
  cadGraph(); cad.failed=false; cad.item=cadById($("cadSel").value)||FormationCadences.all()[0];
  cad.on=true; cad.line=0; cad.half=0; cad.waiting=false; cad.waitPA=null; cad.bag=[]; cad.cpl=[]; cadUnduck();
  cadLoad(cad.item); if(!cad.dry) setTimeout(cadPrefetchAll, 1500);
  $("cadPlay").textContent="■ Off"; $("cadPlay").classList.add("on"); renderCad();
}
function cadStop(){ cadKill(); cad.on=false; cad.waiting=false; cadUnduck(); $("cadPlay").textContent="▶ On"; $("cadPlay").classList.remove("on"); renderCad(); }
/** Stop sound now; remember the unfinished half-line so it is played again from its start. */
function cadKill(){
  const p=cad.play; if(!p) return; cad.play=null;
  if(now()<p.t1){ cad.item=p.item; cad.line=p.line; cad.half=p.half; const h=cad.hist[cad.hist.length-1]; if(h&&h.p===p) h.t1=now(); }
  if(p.src){ try{ p.g.gain.setTargetAtTime(0, actx.currentTime, .015); p.src.stop(actx.currentTime+.08); }catch(_){} }
}
function cadNextItem(){
  const all=FormationCadences.all(); if(all.length<2) return cad.item;
  if(!cad.bag.length){ cad.bag=all.map(c=>c.id).sort(()=>Math.random()-.5); if(cad.bag[0]===cad.item.id) cad.bag.push(cad.bag.shift()); }
  return cadById(cad.bag.shift());
}
function cadAdvance(){
  cad.half^=1; if(cad.half) return;
  if(++cad.line>=cad.item.lines.length){ cad.line=0; if(cad.shuffle){ cad.item=cadNextItem(); cadLoad(cad.item); $("cadSel").value=cad.item.id; } }
}
/** Called on every step strike k. The next strike (k+1) is at clock.nextT: schedule there. */
function cadOnBeat(k){
  if(!cad.on || !cad.item){ return; }
  const active=(marching() && G.move!=="closing") || G.mode==="practice";
  if(!active || G.over){ if(cad.play) cadKill(); renderCad(); return; }               // halted: pause here
  if(cad.ducked && now()-cad.lastTalk>CAD_UNDUCK_MS && !(pendingPrep && now()-pendingPrep.t<PREP_WAIT_MS) && !armed) cadUnduck();
  if(cad.waiting){                                                                   // a command is executing
    const pa=cad.waitPA; if(pa && G.pendingAction===pa && !pa.actT && clock.k<=pa.actK+1) return;
    cad.waiting=false; cad.waitPA=null;
  }
  const kn=k+1, T=clock.nextT;
  if(footOf(kn)!=="L") return;                                                       // every half-line starts on the LEFT foot
  if(cad.play && kn<cad.play.k0+4) return;                                           // current half still sounding
  if(!cadReady(cad.item)) return;
  const item=cad.item, line=cad.line, half=cad.half, v=cadVariant(), vb=CAD_VARIANTS[v], slot=240/vb;
  const rate=clock.period*vb/60000, p={item, line, half, k0:kn, t0:T, t1:T+4*clock.period, v, rate, src:null, g:null};
  if(!cad.dry && actx && cad.gain){
    const buf=cad.bufs[item.id+"-"+v], ac=actx.currentTime;
    let when=ac+(T-now())/1000-(actx.outputLatency||actx.baseLatency||0), off=(2*line+half)*slot;   // heard on the strike
    if(when<ac){ off+=(ac-when)*rate; when=ac; }
    const s=actx.createBufferSource(), g=actx.createGain(); s.buffer=buf; s.playbackRate.value=rate;
    s.connect(g).connect(cad.gain); s.start(when, off, Math.max(.01,(2*line+half+1)*slot-off)); p.src=s; p.g=g;
  }
  cad.play=p; cad.hist.push({p, text:half?item.lines[line].r:item.lines[line].c, t0:T, t1:p.t1}); if(cad.hist.length>4) cad.hist.shift();
  if(cad.log) cad.log.push({k:kn, foot:footOf(kn), t:T, id:item.id, line, half, v, rate, period:clock.period, tempo:G.tempo, prevEnd:cad.log.length?cad.log[cad.log.length-1].end:null, end:p.t1});
  cadAdvance(); renderCad();
}
/** A command is about to execute: stop the cadence; resume the same half-line once it has. */
function cadOnCommand(){ if(!cad.on) return; cadKill(); cad.waiting=true; cad.waitPA=G.pendingAction; cadUnduck(); renderCad(); }
function cadSetGain(){ if(cad.gain) cad.gain.gain.setTargetAtTime(cad.vol*(cad.ducked?CAD_DUCK:1), actx.currentTime, cad.ducked?.03:.25); }
function cadDuck(){ cad.lastTalk=now(); if(!cad.on || cad.ducked) return; cad.ducked=true; cadSetGain(); }
function cadUnduck(){ if(!cad.ducked) return; cad.ducked=false; cadSetGain(); }
/** Output level of the cadence (dBFS, peak-held 250 ms to cover the speaker→mic delay). */
function cadOutDb(){
  if(cad.testOut!==null) return cad.testOut;
  if(!cad.an || !cad.play) return -Infinity;
  cad.an.getFloatTimeDomainData(cad.anBuf); let s=0; for(const x of cad.anBuf) s+=x*x;
  const t=now(), db=10*Math.log10(s/cad.anBuf.length+1e-12);
  cad.outHist.push({t,db}); while(cad.outHist.length && cad.outHist[0].t<t-250) cad.outHist.shift();
  return Math.max(...cad.outHist.map(o=>o.db));
}
/** Is this mic level explained by the cadence coming out of the speaker? Learns the speaker→mic
    coupling (median mic−output level while not ducked); the player must be CAD_BLEED_MARGIN dB above it. */
function cadBleed(db){
  if(!cad.on) return false;
  const out=cadOutDb(); if(!(out>-70)) return false;
  const d=db-out; if(!cad.ducked){ cad.cpl.push(d); if(cad.cpl.length>160) cad.cpl.shift(); }
  if(cad.cpl.length<12) return true;                                                 // still learning: assume it's us
  const s=[...cad.cpl].sort((a,b)=>a-b), c=s[s.length>>1];
  return db < out+c+CAD_BLEED_MARGIN;
}
/** The voice meter heard the player (not the cadence): duck after ~75 ms of voice. */
function cadVoiceFrame(t){
  if(!cad.on) return;
  cad.voiceRun = t-cad.lastVoiceF<60 ? cad.voiceRun+1 : 1; cad.lastVoiceF=t;
  if(cad.voiceRun>=3) cadDuck(); else if(cad.ducked) cad.lastTalk=now();
}
/** Echo guard: does this transcript match the cadence line(s) playing now (or just played)?
    A command spoken over the lyric still counts: only words outside the lyric are parsed. */
function cadEcho(text){
  if(!cad.on) return false;
  const t=now(), lyrics=[];
  for(const h of cad.hist) if(h.t0-300<=t && t<=h.t1+CAD_ECHO_MS) lyrics.push(normText(h.text).split(" ").filter(Boolean));
  if(!lyrics.length) return false;
  const ws=normText(text).split(" ").filter(Boolean); if(!ws.length) return false;
  const same=(a,b)=>a===b||a==="zzunk"||phonKey(a)===phonKey(b);
  const inLyric=w=>lyrics.some(L=>L.some(x=>same(w,x)));
  const frac=ws.filter(inLyric).length/ws.length; if(frac<0.6) return false;
  // longest run of the transcript (from its start, or its end) that is a contiguous piece of a lyric
  const run=(seq,rev)=>{ let best=0; for(const L0 of lyrics){ const L=rev?[...L0].reverse():L0; for(let s0=0;s0<L.length;s0++){ let k=0; while(k<seq.length && s0+k<L.length && same(seq[k],L[s0+k])) k++; best=Math.max(best,k); } } return best; };
  const head=run(ws), tail=run([...ws].reverse(), true);
  const rest1=ws.slice(head).join(" "), rest2=ws.slice(0,ws.length-tail).join(" ");
  return !((rest1 && parseCommand(rest1)) || (rest2 && parseCommand(rest2)));   // a command outside the lyric is the player's
}
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
function renderCad(){
  const box=$("cadLines"); if(!box) return;
  box.style.display=cad.lyrics?"":"none";
  const it=cad.item; if(!it){ box.innerHTML=""; return; }
  const p=cad.play && now()<cad.play.t1 ? cad.play : null, li=p?p.line:cad.line, hf=p?p.half:-1, ln=(p?p.item:it).lines[li];
  const loading=cad.on && !cadReady(it), st= !cad.on ? "" : loading ? (cad.failed? "Voices not downloaded yet: turn cadences on once with a signal, then they work offline" : "Loading voices…") : cad.waiting ? "Executing command…" : !p ? "Starts on the next left foot while marching" : cad.ducked ? "Listening…" : "";
  box.innerHTML=`<div class="call"><span class="${hf===0?"now":""}">${esc(ln.c)}</span></div>
    <div class="resp"><span class="${hf===1?"now":""}">↳ ${esc(ln.r)}</span></div>
    <div class="lic">${st?esc(st)+" · ":""}${esc((p?p.item:it).title)} · line ${li+1}/${(p?p.item:it).lines.length}${cad.shuffle?" · shuffle":""}<br>${esc(it.license)} Source: ${esc(it.source)}</div>`;
}

/* ======================================================================
   HUD / UI
====================================================================== */
function updateHUD(){
  $("score").textContent=G.score; $("hi").textContent=hiScore; $("hiStart").textContent=hiScore;
  $("strength").textContent=allSoldiers().length; $("bpm").textContent=Math.round(bpm());
  $("hudScore").style.visibility=G.mode==="snake"?"visible":"hidden";
}
function setStateTag(){
  if(!G) return;
  const m={halt:"AT THE HALT",forward:"FORWARD",mark:"MARK TIME",half:"HALF STEP",rstep:"RIGHT STEP",lstep:"LEFT STEP",back:"BACKWARD",pivot:"REAR MARCH",closing:"HALTING"}[G.move]||G.move;
  const post = G.move==="halt" ? ({attention:"ATTENTION",parade:"PARADE REST",standease:"STAND AT EASE",atease:"AT EASE"}[G.posture]) : (G.tempo==="double"?"DOUBLE TIME":"QUICK TIME");
  $("stateTag").innerHTML=(F&&F.mode==="counter"?"COUNTER COLUMN":m)+"<br>"+post+(G.dress?" · DRESS RIGHT":"")+(G.eyes?" · EYES RIGHT":"")+(F&&F.interval<1?" · CLOSE INT":"")+(F&&F.rankDist>1?" · OPEN RANKS":"");
}
function show(id){ document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on",s.id===id)); }
function buildReference(){
  document.querySelector("#refTable tbody").innerHTML=CMDS.map(c=>`<tr><td class="cmd">${esc(c.name)}</td><td>${c.foot==="L"?"Left":c.foot==="R"?"Right":c.foot==="either"?"Either":"—"}</td>
    <td><span class="tag">${c.when==="halt"?"at halt":c.when==="march"?"marching":"any"}</span>${esc(c.desc)}</td></tr>`).join("");
}

/* ======================================================================
   MAIN LOOP
====================================================================== */
let running=false, lastFrame=0;
function onBeat(k){
  curBeat=k;
  const due=G.sched.filter(a=>a.k<=k); G.sched=G.sched.filter(a=>a.k>k);
  for(const a of due) a.fn();
  const foot=footOf(k), active=marching()||G.mode==="practice";
  if(active) tick(foot);
  $("fL").classList.toggle("hit", active && foot==="L");
  $("fR").classList.toggle("hit", active && foot==="R");
  cadOnBeat(k);
  updateHUD(); setStateTag();
}
function step(t){
  const dt=Math.min(100, t-lastFrame); lastFrame=t;
  clock.period=60000/bpm();
  if(t-clock.nextT>1000) clock.nextT=t;                     // resync after the tab was hidden
  while(t>=clock.nextT){ clock.lastT=clock.nextT; const k=clock.k++; clock.nextT+=clock.period; onBeat(k); }
  runLater(t);
  const dtBeats=dt/clock.period;
  if(G.mode!=="practice") advance(dtBeats);
  layoutSoldiers(dtBeats,false);
  if(G.mode!=="practice") sgtUpdate(dt);
  scatterUpdate(dt); coverUpdate();
  snakeRules();
  const frac=clamp((t-clock.lastT)/clock.period,0,1);
  const phase=(footOf(clock.k-1)==="L"?0:1)+frac;           // beats since the last LEFT strike
  if(G.sgt) G.sgt.phase=phase;
  draw(marching()||G.mode==="practice"?phase:0);
  drawMeter();
}
function frame(){ if(!running) return; step(now()); requestAnimationFrame(frame); }
async function begin(mode){
  settings.sens=$("sens").value; saveSens(settings.sens); settings.unit=$("unitWord").value; settings.tick=$("tickOn").checked;
  ensureAudio();
  micMode=$("micMode").value; localStorage.setItem("formation.micMode",micMode);
  if(micMode==="both" && !micOK) coexist=null;
  if(micMode==="rec" && micOK) stopMic();
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) await setupMeter();
  else meterOffReason="Voice meter unavailable in this browser";
  if(!recOn) startRecognition(); else restartRec();
  show("game"); resize();      // size the canvas first: the Snake field is fitted to it
  newGame(mode,{scatter:true});
  if(mode==="practice"){ G.move="mark"; flash("INFLECTION PRACTICE","ok",'Say any command, e.g. "Column right… MARCH!" Watch the meter.'); }
  else flash(mode==="snake"?"SNAKE: CALL FALL IN":"DRILL FIELD: CALL FALL IN","ok",`Your soldiers are scattered. Say "Fall in" to form them up, then "Forward… MARCH!" to step off.`);
  if(!SR) $("detail").textContent="Speech recognition isn't supported in this browser. Only the inflection meter works.";
  clock.lastT=now(); clock.nextT=now()+clock.period; lastFrame=now();
  if(!running){ running=true; requestAnimationFrame(frame); }
}

/* ---------- Wire up the UI ---------- */
document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>begin(b.dataset.mode)));
$("btnRef").onclick=()=>show("ref"); $("refBack").onclick=()=>show("start");
$("execMode").value=execMode;
$("execMode").addEventListener("change",()=>{ execMode=$("execMode").value; localStorage.setItem("formation.execMode",execMode); switchMisses=0; });
$("clarity").value=settings.clarity;
$("clarity").addEventListener("change",()=>{ settings.clarity=$("clarity").value; localStorage.setItem("formation.clarity",settings.clarity); });

/* ---------- Train my voice: say each core command twice; keep what Chrome hears as personal aliases ---------- */
const TRAIN_IDS=["forward","halt","colL","colR","colHL","colHR","lflank","rflank","rear","counter","mark","halfstep","change","double","quick"];
const trainPhrase=id=> id==="halt" ? settings.unit.toUpperCase()+", HALT" : CMD[id].name.toUpperCase();
let trainI=0, trainTake=0, trainRecObj=null;
function trainRender(){
  $("trainStep").textContent=`Command ${trainI+1} of ${TRAIN_IDS.length} · take ${trainTake+1} of 2`;
  $("trainCmd").textContent=trainPhrase(TRAIN_IDS[trainI]);
  const all=Object.entries(userAliases).flatMap(([id,l])=>(l||[]).map(ph=>[id,ph]));
  $("trainCount").textContent=all.length;
  $("trainList").innerHTML=all.map(([id,ph])=>`"${esc(ph)}" → ${esc(CMD[id].name)}`).join("<br>")||"<i>Nothing yet.</i>";
}
function trainStopRec(){ try{ if(trainRecObj){ trainRecObj.onresult=null; trainRecObj.onend=null; trainRecObj.abort(); } }catch(_){} trainRecObj=null; $("trainRec").classList.remove("held"); }
/** Store what Chrome heard for this command. Skips guesses that are already another command. Returns notes for display. */
function trainLearn(id, transcripts){
  const notes=[]; const list=userAliases[id]||(userAliases[id]=[]);
  for(const raw of transcripts){
    const n=normText(raw); if(!n || n.split(" ").length<2) continue;
    const ex=parseExact(n), fz=ex?null:fuzzyParse(n);
    const got=(ex||fz)&&(ex||fz).cmd.id;
    if(got===id){ notes.push(`"${raw}" ✓ already understood`); continue; }
    if(got && got!==id){ notes.push(`"${raw}" skipped (sounds like ${CMD[got].name})`); continue; }
    if(!list.includes(n)){ list.push(n); notes.push(`"${raw}" → saved`); }
  }
  if(list.length>12) list.splice(0,list.length-12);
  if(!list.length) delete userAliases[id];
  saveAliases(); return notes;
}
function trainNext(){ trainTake++; if(trainTake>=2){ trainTake=0; trainI=Math.min(TRAIN_IDS.length-1,trainI+1); if(trainI===TRAIN_IDS.length-1 && trainTake===0){} } trainRender(); }
$("btnTrain").onclick=()=>{ if(recOn) stopListening(); trainI=0; trainTake=0; $("trainHeard").textContent=""; trainRender(); show("train"); };
$("trainBack").onclick=()=>{ trainStopRec(); show("start"); };
$("trainSkip").onclick=()=>{ trainStopRec(); trainTake=0; trainI=(trainI+1)%TRAIN_IDS.length; $("trainHeard").textContent=""; trainRender(); };
$("trainPrev").onclick=()=>{ trainStopRec(); trainTake=0; trainI=(trainI+TRAIN_IDS.length-1)%TRAIN_IDS.length; $("trainHeard").textContent=""; trainRender(); };
$("trainReset").onclick=()=>{ if(!confirm("Forget everything learned from your voice?")) return; userAliases={}; saveAliases(); $("trainHeard").textContent="Reset. The game uses the built-in sound-alikes only."; trainRender(); };
$("trainRec").onclick=()=>{
  if(!SR){ $("trainHeard").textContent="Speech recognition isn't available in this browser."; return; }
  trainStopRec();
  const r=new SR(); r.lang="en-US"; r.interimResults=false; r.maxAlternatives=8; r.continuous=false; addGrammar(r);
  const id=TRAIN_IDS[trainI]; let got=false;
  r.onresult=e=>{
    const res=e.results[e.results.length-1]; if(!res || !res.isFinal) return; got=true;
    const alts=[...res].map(a=>a.transcript.trim()).filter(Boolean);
    const notes=trainLearn(id, alts);
    $("trainHeard").innerHTML=notes.map(esc).join("<br>")||"Heard nothing usable. Try again.";
    trainStopRec(); trainNext();
  };
  r.onerror=e=>{ $("trainHeard").textContent="Mic error: "+e.error+". Tap to try again."; };
  r.onend=()=>{ $("trainRec").classList.remove("held"); if(!got && !$("trainHeard").textContent) $("trainHeard").textContent="Didn't catch that. Tap and try again."; };
  trainRecObj=r; $("trainHeard").textContent="🎙 Listening… say: "+trainPhrase(id);
  $("trainRec").classList.add("held");
  try{ r.start(); }catch(_){ $("trainHeard").textContent="Couldn't start the mic. Tap again."; }
};
$("btnQuit").onclick=()=>{ running=false; cadStop(); stopListening("🎙 Mic off"); show("start"); $("hiStart").textContent=hiScore; };
$("ovBtn").onclick=async()=>{                                       // a tap (user gesture) turns the mic back on
  newGame(G.mode,{scatter:true}); flash("CALL FALL IN","ok",'Soldiers are scattered again. Say "Fall in" to form them up.');
  await resumeListening(); };
$("cadToggle").onclick=()=>{ $("cadBar").classList.toggle("collapsed"); cadGraph(); };   // tap = user gesture: unlock Web Audio (Android WebView too)
$("cadPlay").onclick=()=>cad.on?cadStop():cadStart();
$("cadSel").onchange=()=>{ if(cad.on){ cadKill(); cad.item=cadById($("cadSel").value); cad.line=0; cad.half=0; cad.bag=[]; cadLoad(cad.item); } else { cad.item=cadById($("cadSel").value); cad.line=0; cad.half=0; } renderCad(); };
$("cadShuf").onclick=()=>{ cad.shuffle=!cad.shuffle; cad.bag=[]; localStorage.setItem("formation.cadShuffle",cad.shuffle?"1":"0"); $("cadShuf").classList.toggle("on",cad.shuffle); $("cadShuf").setAttribute("aria-pressed",cad.shuffle); renderCad(); };
$("cadShuf").classList.toggle("on",cad.shuffle); $("cadShuf").setAttribute("aria-pressed",cad.shuffle);
$("cadVol").value=cad.vol; $("cadVol").oninput=()=>{ cad.vol=+$("cadVol").value; localStorage.setItem("formation.cadVol",cad.vol); cadSetGain(); };
$("cadLyr").checked=cad.lyrics; $("cadLyr").onchange=()=>{ cad.lyrics=$("cadLyr").checked; localStorage.setItem("formation.cadLyrics",cad.lyrics?"1":"0"); renderCad(); };
if(!SR){ $("noSR").classList.add("on"); if(IS_IOS && IN_APP_BROWSER) $("noSRwhy").innerHTML="This app's built-in browser has no speech recognition. Tap <b>⋯</b> or the share button and choose <b>Open in Safari</b>."; }
/* ---------- iOS / Safari: taps unlock audio, coming back to the app restarts the mic ---------- */
$("tapResume").addEventListener("click",()=>{ hideTapResume(); recFails=0; recBackoff=0; ensureAudio(); if(recOn) restartRec(); else if(G && !G.over) startRecognition(); });
const unlockAudio=()=>{ if(actx && actx.state!=="running") ensureAudio(); };
["touchend","click","keydown"].forEach(ev=>document.addEventListener(ev, unlockAudio, {passive:true, capture:true}));
document.addEventListener("visibilitychange",()=>{
  if(document.hidden || !recOn) return;
  ensureAudio();
  if(micStream && micStream.getAudioTracks().some(t=>t.readyState==="ended")){ stopMic(); setupMeter(); }  // iOS ends the mic in the background
  if(!(typeof NATIVE!=="undefined" && NATIVE)){ recFails=0; recBackoff=0; restartRec(); }
});
let lastTouchEnd=0;   // stop double-tap zoom on older iOS that ignores touch-action
document.addEventListener("touchend",e=>{ const t=Date.now(); if(t-lastTouchEnd<300 && !e.target.closest("select,input,textarea")) e.preventDefault(); lastTouchEnd=t; }, {passive:false});
document.addEventListener("gesturestart",e=>e.preventDefault());
if(DEBUG) $("debug").classList.add("on");
const dbgSend=()=>{ const v=$("dbgIn").value, p=parseCommand(v); $("heardTxt").textContent=v; if(!p){ $("heardTxt").textContent=v+" (ignored)"; return; } judge(p,v,now(),true); $("dbgIn").value=""; };
$("dbgGo").onclick=dbgSend; $("dbgIn").addEventListener("keydown",e=>{ if(e.key==="Enter") dbgSend(); });
$("hiStart").textContent=hiScore;
$("micMode").value=micMode;
$("micMode").addEventListener("change",()=>{ micMode=$("micMode").value; localStorage.setItem("formation.micMode",micMode); if(micMode==="auto") { coexist=null; localStorage.removeItem("formation.coexist"); } });
const pb=$("pttBtn");
pb.addEventListener("pointerdown",pttDown); ["pointerup","pointercancel","pointerleave"].forEach(ev=>pb.addEventListener(ev,pttUp));
pb.addEventListener("contextmenu",e=>e.preventDefault());
$("sens").value=settings.sens;                                   // restore saved difficulty (default Recruit)
$("sens").addEventListener("change",()=>{ settings.sens=$("sens").value; saveSens(settings.sens); });
fillCadences(); buildReference();
function cadApplyEnabled(){ $("cadBar").style.display=CADENCES_ENABLED?"":"none"; $("cadHelp").style.display=CADENCES_ENABLED?"":"none"; if(!CADENCES_ENABLED && cad.on) cadStop(); }
cadApplyEnabled();

/* ---------- Test hook (automated tests only; not used in normal play) ---------- */
window.FG = {
  parse:t=>{ const p=parseCommand(t); return p? p.cmd.id : null; },
  fuzzy:(t,c)=>fuzzyParse(t,{debug:true,clarity:c}), phonKey:w=>phonKey(w), trainLearn:(id,a)=>trainLearn(id,a), aliases:()=>userAliases,
  cmd(text){ const p=parseCommand(text); if(!p) return "invalid"; judge(p,text,now(),true); return p.cmd.id; },
  /** Start a mode without mic/speech (headless): */
  startHeadless(mode, scatter){ show("game"); resize(); newGame(mode,{scatter:!!scatter}); clock.lastT=now(); clock.nextT=now()+clock.period; lastFrame=now(); },
  /** Advance the simulation by ms in 16 ms steps (virtual time), then render. */
  sim(ms){ let t=lastFrame; const end=t+ms; while(t<end){ t+=16; simNow=t; step(t); } },
  state:()=>({move:G.move, tempo:G.tempo, fmode:F.mode, W:F.W, ranks:F.ranks.length, busy:G.busy, over:G.over, score:G.score, posture:G.posture,
             heading:Math.round(((F.mode==="column"?F.path.posAt(F.ranks[0].s).h:0)/D2R%360+360)%360),
             soldiers:allSoldiers().map(s=>[+s.x.toFixed(2),+s.y.toFixed(2),Math.round(((s.face/D2R)%360+360)%360)])}),
  setRecOn(v){ recOn=v; },
  now(){ return now(); },
  addRecruit(){ addRecruitToFormation(); },
  phase:()=>G.phase,
  bang:()=>({on: !!(G.bangT && now()-G.bangT<BANG_MS), n:G.bangN||0, t:G.bangT||null}),
  cover:()=>({cover:!!G.cover, kind:G.cover?G.cover.kind:null, hold:!!(G.cover&&G.cover.hold), sloppy:!!G.sloppy, interval:F.interval, rankDist:F.rankDist}),
  arms:()=>{ const k=G.mode==="snake"?1.4:1.25, sol=allSoldiers();
    return sol.map(s=>{ const arm=G.cover? (s.arm||null) : null, o={x:s.x,y:s.y,face:s.face,arm};
      if(arm==="hip"){ const d=dirV(s.face), n=nrmV(s.face), e=hipElbow(F.interval,k);
        const ex=s.x+(n[0]*e-d[0]*HIP_BACK)*k, ey=s.y+(n[1]*e-d[1]*HIP_BACK)*k;    // elbow centre (world)
        const hx=s.x+(n[0]*HIP_HAND[0]+d[0]*HIP_HAND[1])*k, hy=s.y+(n[1]*HIP_HAND[0]+d[1]*HIP_HAND[1])*k;
        o.elbow=[ex,ey]; o.hand=[hx,hy]; o.side=(ex-s.x)*n[0]+(ey-s.y)*n[1]; o.ahead=(ex-s.x)*d[0]+(ey-s.y)*d[1];
        o.handSide=(hx-s.x)*n[0]+(hy-s.y)*n[1]; o.handDist=Math.hypot(hx-s.x,hy-s.y)/k;
        // gap from the elbow's outer edge to the nearest other body (negative = overlap)
        let best=null; for(const q of sol){ if(q===s) continue; const g=Math.hypot(q.x-ex,q.y-ey)-(BODY_R+HIP_LW/2)*k; if(!best||g<best.g) best={g,q}; }
        o.gap=best? best.g : Infinity;
        if(best){ const q=best.q; o.touchSide=(q.x-s.x)*n[0]+(q.y-s.y)*n[1]; o.touchAhead=(q.x-s.x)*d[0]+(q.y-s.y)*d[1]; }
      } else if(arm){ const d=dirV(s.face), n=nrmV(s.face), v= arm==="lat"? [-n[0],-n[1]] : d, L=armGeom(s.armReach,k,arm);
        const sx=s.x-n[0]*ARM_SH*k, sy=s.y-n[1]*ARM_SH*k, hx=sx+v[0]*L*k, hy=sy+v[1]*L*k;
        const tx=hx+v[0]*ARM_HAND*k, ty=hy+v[1]*ARM_HAND*k;               // fingertip
        o.tip=[tx,ty]; o.gap=Math.min(...sol.filter(q=>q!==s).map(q=>Math.hypot(q.x-tx,q.y-ty)-BODY_R*k));
        o.side = (tx-s.x)*n[0]+(ty-s.y)*n[1]; o.ahead=(tx-s.x)*d[0]+(ty-s.y)*d[1]; }
      return o; }); },
  visual:()=>allSoldiers().map(s=>{ const o=visOff(s); return {x:s.x,y:s.y,vx:s.x+o[0],vy:s.y+o[1],df:o[2]}; }),
  isBareExec,
  look:()=>allSoldiers().map(s=>{ const halted=G.move==="halt" && F.mode!=="counter"; const L=lookAtSgt(s,halted); return L==null? null : {rel:L, gaze:s.face+L, toSgt:Math.atan2(G.sgt.x-s.x,-(G.sgt.y-s.y))}; }),
  dressArms:()=>{ const k=G.mode==="snake"?1.4:1.25, sol=allSoldiers(), out=[];
    F.ranks.forEach(rk=>rk.sol.forEach((s,q)=>{ if(!s) return; const o={q, arm:!!(G.dress && q!==0)};
      if(o.arm){ const n=nrmV(s.face), g=armGeom(F.interval,k,"lat"), L=(ARM_SH+g+ARM_HAND)*k, tx=s.x-n[0]*L, ty=s.y-n[1]*L;
        o.side=(tx-s.x)*n[0]+(ty-s.y)*n[1]; o.gap=Math.min(...sol.filter(z=>z!==s).map(z=>Math.hypot(z.x-tx,z.y-ty)-BODY_R*k)); }
      out.push(o); })); return out; },
  // tests: skip the fall-in run
  formNow(){ if(G.phase==='scatter') startFallIn(); if(G.phase==='forming'){ for(const s of allSoldiers()){ s.arrived=true; const tg=slotTarget(s); s.x=tg.x; s.y=tg.y; } if(G.sgt) G.sgt.arrived=true; finishFallIn(); } },
  sgtRaw:()=>G.sgt && {x:G.sgt.x,y:G.sgt.y,face:G.sgt.face,corner:G.sgt.corner,run:!!G.sgt.run,post:G.sgt.post}, bounds:()=>scatterBounds(),
  sgt(){ const S=G.sgt; if(!S) return null; const fr=sgtFrame(S.ccH); const u=(S.x-fr.cx)*fr.d[0]+(S.y-fr.cy)*fr.d[1], v=(S.x-fr.cx)*fr.n[0]+(S.y-fr.cy)*fr.n[1];
    const [tx,ty]=sgtTarget(fr); let md=1e9; for(const s of fr.sol) md=Math.min(md,Math.hypot(s.x-S.x,s.y-S.y));
    return {x:+S.x.toFixed(2), y:+S.y.toFixed(2), h:Math.round((fr.h/D2R%360+360)%360), out:+(fr.vmin-v).toFixed(2), depthOff:+(u-(fr.umin+fr.umax)/2).toFixed(2),
            toTarget:+Math.hypot(tx-S.x,ty-S.y).toFixed(2), minDist:+md.toFixed(2), route:S.route, u, v, cx:fr.cx, cy:fr.cy, hr:fr.h}; },
  frame(db,hz){ pushFrame(now(), db, hz||0); },                  // feed the voice meter (tests)
  meter(on){ micOK=on; if(on) noiseFloor=-60; },
  burst:()=>({armed: armed && {id:armed.cmd.id, src:armed.src}, last: lastBurst && {id:lastBurst.id, onsetT:lastBurst.onsetT}, execMode}),
  setExecMode(m){ execMode=m; },
  get G(){return G;}, get F(){return F;}, clock, settings, frames, handleResult, get rec(){return rec;}, get sessionText(){return sessionText;},
  analyse:(id,t)=>{ micOK=true; return analyseInflection(CMD[id], t); }, pushFrame, setFloor:v=>{noiseFloor=v;},
  showAnalysis:a=>{ lastAnalysis=a; },
  cadEnable(v){ CADENCES_ENABLED=!!v; cadApplyEnabled(); }, cadEnabled:()=>CADENCES_ENABLED,
  cad, cadEcho, cadNextItem, cadStart, cadStop, cadVariant, cadBleed, footOf:k=>footOf(k),
};
