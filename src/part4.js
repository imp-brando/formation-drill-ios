
/* ======================================================================
   BEAT CLOCK: beat k is the moment foot(k) strikes the ground. Even = LEFT.
   clock.k is the index of the NEXT beat to fire; curBeat is the one firing.
====================================================================== */
const clock = { k:0, nextT:0, period:625, lastT:0 };
let curBeat = 0;
const footOf = k => (((k%2)+2)%2===0) ? "L" : "R";
function footAtTime(t){ const k=clock.k-1+Math.round((t-clock.lastT)/clock.period); return {k, foot:footOf(k)}; }

/* ======================================================================
   GAME STATE
====================================================================== */
let SNAKE_W=28, SNAKE_H=42;     // parade field in steps (1 unit = one 30-inch step); sized to the screen in newGame
const MIN_CELL_PX=9.6;          // smallest on-screen step (CSS px) at which legs still read clearly
/** Fit as many steps as the field area allows (about 36 x 55 on a phone), keeping soldiers recognisable. */
function pickSnakeField(){
  const r=cv.getBoundingClientRect(); let w=r.width, h=r.height;
  if(w<50||h<50){ w=390; h=590; }
  const cell=Math.max(MIN_CELL_PX, Math.min(w, h*2/3)/36);
  SNAKE_W=clamp(Math.floor(w/cell),26,57); SNAKE_H=clamp(Math.floor(h/cell),39,86);
}
let G=null;      // current game
let F=null;      // formation: {W, rankDist, interval, path, ranks:[{s, sol:[soldier|null per file]}], mode, cc}
let soldierId=0;
function newSoldier(){ return {id:soldierId++, x:0,y:0,face:0, px:null,py:null, spd:0, trans:null, faceAnim:null}; }

/** Column formation: W files, `count` soldiers, front-rank centre (x,y), heading h.
    File index sq: 0 = 1st squad = LEFT file in column (as formed by Right, FACE from line). */
function makeFormation(x,y,h,W,count){
  const back=dirV(h), path=Path.straight(x-back[0]*300, y-back[1]*300, h);
  const f={W, rankDist:1, interval:1, path, ranks:[], mode:"column", cc:null, cShift:0, inLine:false, lineTail:0};
  const D=Math.ceil(count/W); let n=0;
  for(let r=0;r<D;r++){ const sol=new Array(W).fill(null); for(let sq=W-1;sq>=0 && n<count;sq--,n++) sol[sq]=newSoldier(); f.ranks.push({s:300-r, sol}); }
  const g=path.segs[0]; for(const rk of f.ranks){ rk.fs=[]; for(let q=0;q<W;q++) rk.fs.push({seg:g, s:rk.s}); }
  return f;
}
function allSoldiers(){ const out=[]; for(const rk of F.ranks) for(const s of rk.sol) if(s) out.push(s); return out; }

function newGame(mode, opt){
  opt=opt||{};
  G = { mode, score:0, recruits:[], over:false, move:"halt", tempo:"quick", posture:"attention",
        dress:false, eyes:false, sched:[], hitch:false, busy:null, prevMove:"forward", bpmBase: mode==="snake"?112:120,
        phase:"formed" };
  soldierId=0;
  if(mode==="snake"){ pickSnakeField();
    // after a scattered start they fall in mid-field (shorter run for everyone, plenty of room ahead)
    F=makeFormation(SNAKE_W/2, opt.scatter? Math.round(SNAKE_H*0.6) : SNAKE_H-6, 0, 4, 16); }   // 4 x 4 platoon to start
  else F=makeFormation(0,0,0,4, mode==="drill"?16:4);
  layoutSoldiers(0,true);
  sgtInit();
  // Snake and Drill Practice start with the soldiers scattered, strolling; "Fall in" forms them up
  if(opt.scatter && mode!=="practice") scatterStart();
  else if(mode==="snake") spawnRecruits();
  cam.x=0; cam.y=0;
  $("overlay").classList.remove("on");
  updateHUD(); setStateTag();
}
function bpm(){
  if(G.tempo==="double") return 180;
  return G.mode==="snake" ? Math.min(144, G.bpmBase+2*G.score/10) : G.bpmBase;
}

/* ---------- Scheduling: run fn at beat index k ---------- */
function at(k, fn, tag){ G.sched.push({k,fn,tag: tag || (typeof schedTag!=="undefined" ? schedTag : null)}); }
/** Next beat index (>= the next beat to fire) whose foot matches, or the very next beat. */
function nextBeat(foot){ let k=clock.k; if(foot==="L"||foot==="R"){ while(footOf(k)!==foot) k++; } return k; }

/* ======================================================================
   COMMAND EXECUTION: footwork per TC 3-21.5, simplified to whole counts.
   execute() runs ON beat curBeat; curBeat+1 is "one more step".
====================================================================== */
const marching = () => ["forward","mark","half","rstep","lstep","back","pivot","closing"].includes(G.move) || (F && F.mode==="counter");

/** Return why the command can't be executed now, or null. */
function canExecute(c){
  if(G.over && c.id!=="fallin") return "Formation broke. Tap FALL IN";
  if(G.busy && c.id!=="fallin") return "Wait: "+G.busy+" in progress";
  const halted = G.move==="halt";
  if(G.cover && c.id!=="recover") return "Arms are out at COVER. Call RECOVER first";
  if(c.id==="recover" && !G.cover) return "Nothing to recover. Call COVER first";
  if(c.id==="fallin" && !G.over && !halted) return "Halt the formation before FALL IN";
  if(c.id==="forward" && G.move==="forward") return "Already marching forward";
  if(c.when==="halt" && !halted) return "Must be at the halt";
  if(c.when==="march" && halted) return c.id.includes("flank")? "At the halt, use Right/Left, FACE" : c.id==="rear"? "At the halt, use About, FACE" : "Must be marching";
  if(["rstep","lstep","back"].includes(G.move) && !["halt","fallin"].includes(c.id)) return "Halt the formation first";
  const S=SENS[settings.sens];
  const needsAttn = ["forward","colR","colL","colHR","colHL","counter","mark","double","rstep","lstep","back","rface","lface","aface","dress","openranks","closeranks","extend","close","eyes","cover","closeint","normint"];
  if(halted && G.posture!=="attention" && needsAttn.includes(c.id)){
    if(S.needAttn) return "Call "+settings.unit+", ATTENTION first";
    G.posture="attention";
  }
  if(c.id==="counter" && F.W!==4) return "Counter column needs 4 files (column formation)";
  if(c.id==="quick" && G.tempo==="quick") return "Already at quick time";
  if(c.id==="extend" && F.interval===1) return "Already at normal interval";
  if(c.id==="nsteps"){
    if(G.posture!=="attention") return "Steps to the right/left: only from attention";
    if(c.dir!=="R" && c.dir!=="L") return "Steps: only to the right or left";
    if(c.n==null) return "Say how many steps (one to four)";
    if(!(c.n>=1 && c.n<=4)) return "Steps: one to four only";
  }
  if(c.id==="fallout" && G.mode==="practice") return "No FALL OUT in practice";
  if(c.id==="normint" && !(F.closeIv && F.closeIv.axis==="interval")) return "Not at close interval. Call At close interval first";
  return null;
}

/** PICAA: the command of execution counts on beat kE (on the correct foot); troops take ONE
    additional step (kE -> kE+1) and execute on the action step at beat kE+1. Movements from the
    halt have no additional step: the action happens on kE. kE may be the strike that just
    passed (the command was called on it), in which case the additional step is already underway. */
function execute(c, kE){
  const k = kE===undefined ? curBeat : kE, halted=G.move==="halt", stride=strideNow();
  const beatsNow = clock.k-1+clamp((now()-clock.lastT)/clock.period,0,1);
  if(window.__execLog) window.__execLog.push({id:c.id, t:now(), k, beatsNow});   // test hook
  const addl = !halted && ["halt","mark","halfstep","double","quick","change","colR","colL","colHR","colHL","rflank","lflank","rear","counter","forward"].includes(c.id);
  G.pendingAction={id:c.id, kE:k, actK: addl? k+1 : k, actT:null, actBeat:null};
  if(typeof cadOnCommand==="function") cadOnCommand();          // the cadence stops, then picks up on a later left foot
  if(typeof picaaExec==="function") picaaExec(c, k, addl);
  const act=(kk,fn)=>{ if(kk<clock.k) fn(); else at(kk,fn); };   // run on beat kk (now if it has passed)
  const actionDone=()=>{ const pa=G.pendingAction; if(pa && !pa.actT){ pa.actT=now(); pa.actBeat=clock.k-1+clamp((now()-clock.lastT)/clock.period,0,1); } };
  if(c.id==="cover"){ act(k,()=>{ startCover(); actionDone(); }); return; }
  if(c.id==="normint"){ act(k,()=>{ normalInterval(); actionDone(); }); return; }
  if(c.id==="fallout"){ act(k,()=>{ fallOut(); actionDone(); }); return; }
  if(c.id==="closeint"){ act(k,()=>{ startCloseInterval(); actionDone(); }); return; }
  if(c.id==="recover"){ act(k,()=>{ doRecover(); actionDone(); }); return; }
  switch(c.id){
    case "forward":
      if(halted){ realignForStepOff(); G.move="forward"; actionDone(); }
      else act(k+1,()=>{ G.move="forward"; actionDone(); });     // from mark time / half step
      break;
    case "halt":
      act(k+1,()=>{ G.move="closing"; actionDone(); });           // additional step, then…
      act(k+2,()=>{ G.move="halt"; G.tempo="quick"; });          // …the trailing foot comes alongside
      break;
    case "mark": if(halted){ realignForStepOff(); G.move="mark"; } else act(k+1,()=>{ G.move="mark"; actionDone(); }); break;
    case "halfstep": act(k+1,()=>{ G.move="half"; actionDone(); }); break;
    case "double":
      if(halted){ realignForStepOff(); G.move="forward"; G.tempo="double"; }
      else act(k+1,()=>{ G.tempo="double"; if(G.move==="half") G.move="forward"; actionDone(); });
      break;
    case "quick": act(k+1,()=>{ G.tempo="quick"; actionDone(); }); break;
    case "change": G.busy="change step"; act(k+1,()=>{ G.hitch=true; actionDone(); }); act(k+2,()=>{ G.hitch=false; G.busy=null; }); break;
    case "colR": case "colL": case "colHR": case "colHL": {
      const d = (c.id==="colR"||c.id==="colHR")? 1 : -1, ang=(c.id.startsWith("colH")?45:90)*D2R;
      // Square pivot: the corner is placed so the pivot (inside) file reaches ITS pivot point on the
      // action step; every other file marches on to its own pivot point and pivots there.
      const half = d>0 ? laneOf(F.W-1) : -laneOf(0), eIn=half*Math.tan(ang/2);   // distance from the centre line to the pivot file
      if(schedTag) schedTag.pathLen=F.path.segs.length;
      if(halted||G.move==="mark"){ realignForStepOff(); G.move="forward"; F.path.append(F.ranks[0].s+eIn, [{t:"T",ang,d}]); }
      else { if(G.move==="half") G.move="forward";
        const sAct=F.ranks[0].s + stride*Math.max(0,(k+1)-beatsNow);          // where the front is at the action step
        F.path.append(sAct+eIn, [{t:"T",ang,d}]); }
      F._fi=null;
      break; }
    case "rflank": case "lflank":
      G.busy="flank";
      act(k+1,()=>{ flankTransform(c.id==="rflank"?1:-1); G.busy=null; actionDone(); });
      break;
    case "rear":
      G.busy="rear march";
      act(k+1,()=>{ G.prevMove = G.move==="half"?"half":"forward"; G.move="pivot"; rearTransform(); actionDone(); }); // pivot on the balls of both feet
      act(k+2,()=>{ G.move=G.prevMove; G.busy=null; });                                                              // step off with the left foot                                             // step off with the left foot
      break;
    case "counter":
      if(halted){ realignForStepOff(); G.move="forward"; startCounterColumn(); actionDone(); }
      else { G.busy="counter column"; act(k+1,()=>{ if(G.move!=="forward") G.move="forward"; startCounterColumn(); actionDone(); }); }
      break;
    case "rstep": case "lstep": case "back": realignForStepOff(); G.move=c.id; break;
    case "nsteps":                                  // N fifteen-inch steps, then halt on its own (attention)
      realignForStepOff(); G.move = c.dir==="R" ? "rstep" : "lstep"; G.busy=c.n+(c.n===1?" step":" steps")+" to the "+(c.dir==="R"?"right":"left");
      G.nstep={left:c.n*0.5, n:c.n, dir:c.dir}; actionDone(); break;
    case "rface": case "lface": flankTransform(c.id==="rface"?1:-1); break;
    case "aface": rearTransform(); break;
    case "parade": G.posture="parade"; G.dress=false; break;
    case "standease": G.posture="standease"; G.dress=false; break;
    case "atease": G.posture="atease"; G.dress=false; break;
    case "attn": G.posture="attention"; break;
    case "dress": G.dress=true; break;
    case "eyes": G.eyes=true; break;
    case "front": G.dress=false; G.eyes=false; break;
    case "openranks": animateSpacing("rankDist", 2); break;
    case "closeranks": animateSpacing("rankDist", 1); break;
    case "extend": F.closeIv=null; animateSpacing("interval", 1); break;
    case "close": animateSpacing("interval", 0.6); break;
    case "fallin": fallIn(); break;
  }
  setStateTag();
}
/** Re-index the beat so the first swing is the LEFT foot (step off with the left). */
function realignForStepOff(){ if(footOf(clock.k)!=="L") clock.k++; }

/** Distance (in 30-inch units) the formation covers per beat right now. */
function strideNow(){
  const base = G.tempo==="double" ? 1.2 : 1.0;  // 36-inch vs 30-inch step
  switch(G.move){
    case "forward": return G.hitch? base*0.5 : base;
    case "half": case "back": case "rstep": case "lstep": return 0.5;
    default: return 0;  // halt, mark time, pivot, closing
  }
}

/* ---------- Spacing changes (open/close ranks, extend/close interval) ---------- */
function animateSpacing(key, val){
  const old=allSoldiers().map(s=>[s,s.x,s.y]);
  F[key]=val; F._fi=null;
  if(key==="rankDist"){
    const anchor=Math.min(2,F.ranks.length-1), A=F.ranks[anchor];   // 3rd rank stands fast
    F.ranks.forEach((rk,r)=>{ if(r===anchor) return; rk.fs=A.fs.map((fs,q)=>{ const w=fileWalk(q,fs,(anchor-r)*val); return {seg:w.seg,s:w.s}; }); rk.s=rankS(rk); });
  }
  for(const [s,x,y] of old) s.trans={x,y,t0:now(),dur:clock.period*2};
}

/* ---------- Flank / facing: everyone turns 90° in place; ranks become files ---------- */
function flankTransform(d){
  const W=F.W, D=F.ranks.length;
  const p0=F.path.posAt(F.ranks[0].s), h=p0.h, dv=dirV(h), nv=nrmV(h);
  const ideal=(r,sq)=>({x:p0.x-dv[0]*r*F.rankDist+nv[0]*laneOf(sq), y:p0.y-dv[1]*r*F.rankDist+nv[1]*laneOf(sq)});
  const W2=D, D2=W, h2=h+d*90*D2R;
  const ranks2=[]; for(let r=0;r<D2;r++) ranks2.push({s:0,sol:new Array(W2).fill(null)});
  for(let r=0;r<D;r++) for(let sq=0;sq<W;sq++){
    const s=F.ranks[r].sol[sq]; if(!s) continue;
    const r2 = d>0 ? (W-1-sq) : sq, sq2 = d>0 ? r : (D-1-r);
    ranks2[r2].sol[sq2]=s;
    s.trans={x:s.x,y:s.y,t0:now(),dur:clock.period}; s.faceAnim={off:-d*90*D2R,t0:now(),dur:clock.period*.8};
  }
  let cx=0, cy=0;  // centre of the new front rank (= old right or left file)
  for(let sq2=0;sq2<W2;sq2++){ const r=d>0?sq2:(D-1-sq2), sq=d>0?W-1:0, q=ideal(r,sq); cx+=q.x; cy+=q.y; }
  cx/=W2; cy/=W2;
  const b=dirV(h2); F.path=Path.straight(cx-b[0]*300, cy-b[1]*300, h2);
  const rd=F.interval, iv=F.rankDist; F.rankDist=rd; F.interval=iv;
  ranks2.forEach((rk,r)=>rk.s=300-r*F.rankDist);
  F.W=W2; F.ranks=ranks2.filter(rk=>rk.sol.some(Boolean)); F.cShift=0;
  if(F.closeIv) F.closeIv.axis = F.closeIv.axis==="interval" ? "rankDist" : "interval";   // files became ranks
  // squads were files, now they're ranks (or back again). The squads' tail end is where the old rear rank went.
  F.inLine=!F.inLine; F.lineTail = F.inLine ? (d>0 ? 1 : -1) : 0;
  F._fi=null; fsAll();
}

/* ---------- Rear march / about face: the rear rank becomes the front rank ---------- */
function rearTransform(){
  const fi=fileInfo(), segs=F.path.segs;
  let iMax=0, iMin=segs.length-1, sTop=-Infinity;
  for(const rk of F.ranks) for(const fs of rk.fs){ const i=segIndex(fi,fs); iMax=Math.max(iMax,i); iMin=Math.min(iMin,i); sTop=Math.max(sTop,fs.s); }
  sTop+=1;
  // new path = old centre polyline walked backwards; new s = sTop - old s on the matching segment
  const np=new Path(), map=new Map();
  for(let i=iMax;i>=iMin;i--){
    const g=segs[i], d=dirV(g.h), sEnd = i===iMax ? sTop : segs[i+1].s0;
    const ex=g.x+d[0]*(sEnd-g.s0), ey=g.y+d[1]*(sEnd-g.s0);
    const ng={t:"L", x:ex, y:ey, h:g.h+Math.PI, s0:sTop-sEnd, len: i===iMin ? Infinity : sEnd-g.s0, f:1};
    np.segs.push(ng); map.set(g,ng);
  }
  const old=F.ranks, W=F.W;
  F.ranks=old.slice().reverse().map(rk=>{
    const sol=rk.sol.slice().reverse(), fs=[];
    for(let q=0;q<W;q++){ const o=rk.fs[W-1-q]; fs.push({seg:map.get(o.seg)||np.segs[np.segs.length-1], s:sTop-o.s}); }
    return {sol, fs, s:0};
  });
  F.path=np; F._fi=null;
  F.cShift=-(F.cShift||0); F.lineTail=-(F.lineTail||0);    // files reversed: the line's tail end swaps sides
  for(const rk of F.ranks) rk.s=rankS(rk);
  for(const s of allSoldiers()) s.faceAnim={off:-Math.PI,t0:now(),dur:clock.period*.9};
}

/* ---------- Counter column (4 files), per TC 3-21.5 ---------- */
function startCounterColumn(){
  G.busy="counter column";
  const W=4, iv=F.interval, D=F.ranks.length;
  // sq 0..3 = 1st..4th squad (1st squad = left file). Final lanes interleave the old ones so files pass cleanly.
  const pre=[3,1,0,2], dir=[1,1,-1,-1], lanesTo=[2.0,1.0,0.0,-1.0].map(v=>v+(F.cShift||0));   // lanes may sit off the path centre (interval changed about the right file)
  const paths=[], headS=[], endS=[];
  for(let sq=0;sq<W;sq++){
    const lat=laneOf(sq), pts=[];
    const uHead=fileU(sq,F.ranks[0].fs[sq]), uTail=fileU(sq,F.ranks[D-1].fs[sq])-1;
    let st=fileWalk(sq,F.ranks[0].fs[sq],uTail-uHead);
    for(let u=uTail; u<uHead; u+=0.2){ const p=filePos(sq,st); pts.push([p.x,p.y]); st=fileWalk(sq,st,0.2); }
    const ph=filePos(sq,F.ranks[0].fs[sq]); pts.push([ph.x,ph.y]);
    const fp=Path.fromPoints(pts), L=fp.last, hs=L.s0+L.len;
    const w=Math.abs(lanesTo[sq]*iv - lat), rr=Math.min(0.5*iv, w/2);
    fp.append(hs, [{t:"L",len:pre[sq]}, {t:"A",ang:Math.PI/2,r:rr,d:dir[sq]}, {t:"L",len:Math.max(0,w-2*rr)}, {t:"A",ang:Math.PI/2,r:rr,d:dir[sq]}]);
    const lastFinite=fp.segs[fp.segs.length-2];
    paths.push(fp); headS.push(hs); endS.push(lastFinite.s0+lastFinite.len);
  }
  // depth of each soldier behind its file's head, measured along that file's own lane
  const depthQ=[]; for(let sq=0;sq<W;sq++){ const uh=fileU(sq,F.ranks[0].fs[sq]); depthQ.push(F.ranks.map(rk=>uh-fileU(sq,rk.fs[sq]))); }
  F.cc={paths, headS, endS, depthQ};
  F.mode="counter";
}
const CATCHUP_WHEEL=1.2, CATCHUP_MAX=1.25;   // longest catch-up stride, in 30-inch steps (same cadence)
function advanceCounter(dist){
  const cc=F.cc, done=cc.headS.map((h,sq)=>h-cc.endS[sq]), minD=Math.min(...done), maxD=Math.max(...done);
  for(let sq=0;sq<4;sq++){
    // squads that have completed both turns take half steps until the others are abreast;
    // squads that are behind lengthen their stride (up to 1.25 steps, same cadence) to catch up
    const lag=maxD-done[sq];
    const k = (done[sq]>=0 && done[sq]>minD+0.04) ? 0.5 : lag>0.04 ? Math.min(CATCHUP_MAX, 1+lag) : 1;
    cc.headS[sq]+=dist*k;
  }
  const allPast=cc.headS.every((h,sq)=>h-cc.depthQ[sq][cc.depthQ[sq].length-1]>=cc.endS[sq]-1e-6);
  if(allPast && Math.max(...done)-minD<0.06) finishCounterColumn();
}
function finishCounterColumn(){
  const cc=F.cc; let cx=0, cy=0, h=0;
  for(let sq=0;sq<4;sq++){ const p=cc.paths[sq].posAt(cc.headS[sq]); cx+=p.x/4; cy+=p.y/4; h=p.h; }
  const b=dirV(h); F.path=Path.straight(cx-b[0]*300, cy-b[1]*300, h);
  F.ranks.forEach((rk,r)=>{ let d=0; for(let q=0;q<4;q++) d+=cc.depthQ[q][r]/4; rk.s=300-d; });
  F.cShift=0; F._fi=null; fsAll();
  for(const s of allSoldiers()) s.trans={x:s.x,y:s.y,t0:now(),dur:clock.period*.6};
  F.mode="column"; F.cc=null; G.busy=null; setStateTag();
}

function fallIn(){ newGame(G.mode); dishevel(); flash("FALL IN","ok","Formed, but ragged. Call COVER, then RECOVER"); }
function spawnRecruits(){ spawnRecruit(); spawnRecruit(); spawnRecruit(); }   // three recruits out at once on the big field

/* ======================================================================
   FILES AND SQUARE PIVOTS
   The column's centre path is a polyline with sharp corners. Each file walks its own
   lane (the centre line offset sideways by its interval), and the lanes meet at mitred
   corners: every file has its OWN pivot point where its lane turns. A file's state is
   {seg, s}: the centre-path segment whose lane it is on, and its position measured in
   centre-path units ("abreast" files have equal s). At its pivot point the file moves onto
   the next segment; its s jumps (inside files gain, outside files lose) while its body
   doesn't move, which is exactly a pivot in place.
====================================================================== */
const angWrap=a=>{ while(a>Math.PI) a-=2*Math.PI; while(a<=-Math.PI) a+=2*Math.PI; return a; };
function laneOf(q){ return (q-(F.W-1)/2+(F.cShift||0))*F.interval; }   // cShift: lanes off-centre after a file is added to a line
/** Per-file corner thresholds for the current path (cached until the path changes). */
function fileInfo(){
  const P=F.path, segs=P.segs, key=segs.length+":"+segs[0].s0+":"+F.W+":"+F.interval+":"+(segs[segs.length-1].s0);
  if(F._fi && F._fi.P===P && F._fi.key===key) return F._fi;
  const n=segs.length, idx=new Map(); segs.forEach((g,i)=>idx.set(g,i));
  const files=[];
  for(let q=0;q<F.W;q++){
    const L=laneOf(q), st=[], en=[], U=[]; let u=0;
    for(let i=0;i<n;i++){
      const dIn = i>0 ? clamp(angWrap(segs[i].h-segs[i-1].h),-2.9,2.9) : 0;
      const dOut= i<n-1 ? clamp(angWrap(segs[i+1].h-segs[i].h),-2.9,2.9) : 0;
      st[i]=segs[i].s0 + L*Math.tan(dIn/2);
      en[i]= i<n-1 ? segs[i+1].s0 - L*Math.tan(dOut/2) : Infinity;
      U[i]=u; if(i<n-1) u+=en[i]-st[i];
    }
    files.push({L,st,en,U});
  }
  return F._fi={P,key,idx,files};
}
function segIndex(fi,fs){ const i=fi.idx.get(fs.seg); return i===undefined ? 0 : i; }
/** Distance walked along file q's own lane up to state fs (for spacing between ranks). */
function fileU(q,fs){ const fi=fileInfo(), f=fi.files[q], i=segIndex(fi,fs); return f.U[i]+fs.s-f.st[i]; }
/** Walk file q forward (du>0) or back (du<0) along its own lane, pivoting at its pivot points. */
function fileWalk(q,fs,du){
  const fi=fileInfo(), f=fi.files[q], segs=F.path.segs; let i=segIndex(fi,fs), s=fs.s+du, pivoted=false;
  while(i<segs.length-1 && s>=f.en[i]){ s=f.st[i+1]+(s-f.en[i]); i++; pivoted=true; }
  while(i>0 && s<f.st[i]){ s=f.en[i-1]-(f.st[i]-s); i--; }
  return {seg:segs[i], s, pivoted};
}
function filePos(q,fs){ const g=fs.seg, d=dirV(g.h), n=nrmV(g.h), L=laneOf(q), u=fs.s-g.s0;
  return {x:g.x+d[0]*u+n[0]*L, y:g.y+d[1]*u+n[1]*L, h:g.h}; }
/** Put every file of a rank abreast at centre position s (after the path was rebuilt). */
function fsInit(rk){ const g=F.path.segAt(rk.s); rk.fs=[]; for(let q=0;q<F.W;q++) rk.fs.push({seg:g, s:rk.s}); }
function fsAll(){ for(const rk of F.ranks) fsInit(rk); }
function rankS(rk){ let t=0; for(const f of rk.fs) t+=f.s; return t/rk.fs.length; }
function onNewestSeg(fs){ return fs.seg===F.path.last || fileInfo().idx.get(fs.seg)===F.path.segs.length-1; }

/* ======================================================================
   MOVEMENT UPDATE (called every frame with elapsed time in beats)
====================================================================== */
function advance(dtBeats){
  if(G.over || G.phase!=="formed") return;
  const dist=strideNow()*dtBeats;
  if(F.mode==="counter"){ advanceCounter(dist); return; }
  if(G.move==="rstep"||G.move==="lstep"||G.move==="back"){
    const h=F.path.posAt(F.ranks[0].s).h;
    const v = G.move==="back"? dirV(h).map(x=>-x) : nrmV(h).map(x=>G.move==="rstep"?x:-x);
    let dd=dist;
    if(G.nstep){ dd=Math.min(dist, G.nstep.left); G.nstep.left-=dd; }
    F.path.translate(v[0]*dd, v[1]*dd);
    if(G.nstep && G.nstep.left<=1e-9){ G.nstep=null; G.move="halt"; G.busy=null; G.posture="attention"; setStateTag(); }
    return;
  }
  if(dist<=0) return;
  const r0=F.ranks[0], W=F.W;
  // Front rank. Each file marches to ITS OWN pivot point and pivots there (square corner).
  // Files that have pivoted take half steps until the rest are abreast; files that are behind
  // lengthen their stride (up to 1.25 steps, same cadence) to come abreast sooner.
  const pres=[]; for(let q=0;q<W;q++) if(F.ranks.some(rk=>rk.sol[q])) pres.push(q);
  const newest=pres.map(q=>onNewestSeg(r0.fs[q])), allNew=newest.every(Boolean), anyNew=newest.some(Boolean);
  const sv=pres.map(q=>r0.fs[q].s), minS=Math.min(...sv), maxS=Math.max(...sv);
  for(let q=0;q<W;q++){
    const j=pres.indexOf(q); let k=1;
    if(j>=0 && anyNew && !(allNew && maxS-minS<0.02)){
      if(newest[j] && (!allNew || sv[j]>minS+0.02)) k=0.5;                        // pivoted: half steps
      else k = allNew ? Math.min(CATCHUP_MAX, 1+(maxS-sv[j])) : CATCHUP_MAX;      // behind: longer strides
    }
    const oh=r0.fs[q].seg.h, w=fileWalk(q,r0.fs[q],dist*k); r0.fs[q]={seg:w.seg,s:w.s};
    if(w.pivoted && r0.sol[q]) markPivot(r0.sol[q], q, oh, true);
  }
  r0.s=rankS(r0);
  // Rear ranks: every soldier covers down on the soldier ahead in his file, one step back along
  // the file's lane, pivoting at the same pivot point; longer strides (same cadence) to close up.
  for(let r=1;r<F.ranks.length;r++){
    const rk=F.ranks[r], prev=F.ranks[r-1];
    for(let q=0;q<W;q++){
      const gap=fileU(q,prev.fs[q])-fileU(q,rk.fs[q]);
      let ds=dist; if(gap>F.rankDist+0.01) ds=Math.min(dist*CATCHUP_MAX, gap-F.rankDist+dist);
      ds=Math.max(0, Math.min(ds, gap-F.rankDist));
      const oh=rk.fs[q].seg.h, w=fileWalk(q,rk.fs[q],ds); rk.fs[q]={seg:w.seg,s:w.s};
      if(w.pivoted && rk.sol[q]) markPivot(rk.sol[q], q, oh, false);
    }
    rk.s=rankS(rk);
  }
  let sMin=Infinity; for(const rk of F.ranks) for(const f of rk.fs) sMin=Math.min(sMin,f.s);
  F.path.prune(sMin-20);
}
/** Visual pivot: the facing snaps round over a quarter beat; test hook records it. */
function markPivot(sol, q, oldH, front){
  const nh=F.ranks.find(rk=>rk.sol[q]===sol).fs[q].seg.h;
  sol.faceAnim={off:angWrap(oldH-nh), t0:now(), dur:clock.period*0.3};          // snap round on the ball of the foot
  const beat=clock.k-1+clamp((now()-clock.lastT)/clock.period,0,1);
  if(window.__pivotLog) window.__pivotLog.push({t:now(), beat, q, front});
  const pa=G.pendingAction;
  if(front && pa && /^col/.test(pa.id) && !pa.actT){ pa.actT=now(); pa.actBeat=beat; }
}

/** Each soldier's displayed position and facing (with transitions), plus measured step speed. */
function layoutSoldiers(dtBeats, snap){
  if(G && G.phase && G.phase!=="formed") return;          // scattered / falling in: positions handled by scatterUpdate
  const t=now();
  F.ranks.forEach((rk,r)=>rk.sol.forEach((s,sq)=>{
    if(!s) return;
    const p = F.mode==="counter" ? F.cc.paths[sq].posAt(F.cc.headS[sq]-F.cc.depthQ[sq][r]) : filePos(sq,rk.fs[sq]);
    let x=p.x, y=p.y, face=p.h;
    if(s.trans){ const u=(t-s.trans.t0)/s.trans.dur; if(u>=1) s.trans=null; else { const e=ease(u); x=lerp(s.trans.x,x,e); y=lerp(s.trans.y,y,e); } }
    if(s.faceAnim){ const u=(t-s.faceAnim.t0)/s.faceAnim.dur; if(u>=1) s.faceAnim=null; else face+=s.faceAnim.off*(1-ease(u)); }
    if(!snap && s.px!==null && dtBeats>0){ const v=Math.hypot(x-s.px,y-s.py)/dtBeats; s.spd=lerp(s.spd, Math.min(v,2), .25); }
    if(snap) s.spd=0;
    s.px=x; s.py=y; s.x=x; s.y=y; s.face=face;
  }));
}

/* ---------- Snake rules ---------- */
function spawnRecruit(){
  const sol=allSoldiers();
  for(let tries=0;tries<300;tries++){
    const x=1+Math.floor(Math.random()*(SNAKE_W-2))+.5, y=1+Math.floor(Math.random()*(SNAKE_H-2))+.5;
    if(sol.every(s=>Math.hypot(s.x-x,s.y-y)>2) && !(G.sgt && Math.hypot(G.sgt.x-x,G.sgt.y-y)<1.5)){ G.recruits.push({x,y,face:Math.floor(Math.random()*8)*45*D2R,t:now()}); return; }
  }
}
function addRecruitToFormation(){
  // In line (after a flank) the squads are ranks: a recruit falls in at the squad's tail, which is the end
  // file of the line, filled front to back, then a new file opens at that end. In column: rear rank, right first.
  if(F.inLine){
    if(F.mode!=="column" || G.busy || !F.ranks.every(rk=>rk.fs.every(onNewestSeg))){ G.pendingRecruits=(G.pendingRecruits||0)+1; return; }   // mid-maneuver: fall in once straight
    let tq = F.lineTail>0 ? F.W-1 : 0;
    let rk=F.ranks.find(rk=>!rk.sol[tq]);
    if(!rk){
      for(const r of F.ranks){
        const ref=r.fs[tq], f={seg:ref.seg, s:ref.s};
        if(F.lineTail>0){ r.sol.push(null); r.fs.push(f); } else { r.sol.unshift(null); r.fs.unshift(f); }
      }
      F.W++; F.cShift=(F.cShift||0)+(F.lineTail>0 ? .5 : -.5);       // every existing soldier keeps his lane
      tq = F.lineTail>0 ? F.W-1 : 0; F._fi=null; rk=F.ranks[0];
    }
    const s=newSoldier(); rk.sol[tq]=s; placeRecruit(s, tq, rk); return;
  }
  const last=F.ranks[F.ranks.length-1], s=newSoldier();
  let empty=-1; for(let sq=F.W-1;sq>=0;sq--) if(!last.sol[sq]){ empty=sq; break; }   // fill from the right file
  if(empty>=0){ last.sol[empty]=s; placeRecruit(s, empty, last); }
  else { const sol=new Array(F.W).fill(null); sol[F.W-1]=s;
    const fs=last.fs.map((f,q)=>{ const w=fileWalk(q,f,-F.rankDist); return {seg:w.seg,s:w.s}; });
    const rk={sol, fs, s:0}; rk.s=rankS(rk); F.ranks.push(rk); placeRecruit(s, F.W-1, rk); }
}
/** Put a new soldier straight onto his slot (facing the formation's direction), so nobody straggles. */
function placeRecruit(s, q, rk){
  if(!rk.fs || !rk.fs[q]) return;
  const p=filePos(q, rk.fs[q]); if(!p) return;
  s.x=p.x; s.y=p.y; s.face=p.h; s.px=null; s.py=null;
  if(G.sloppy) makeSloppy(s);                    // joins a ragged formation ragged; a covered one cleanly
}
function snakeRules(){
  if(G.mode!=="snake"||G.over||G.phase!=="formed") return;   // no formation yet: walls and bumps never break it
  const sol=allSoldiers();
  if(!window.__noWalls) for(const s of sol) if(s.x<0.25||s.x>SNAKE_W-0.25||s.y<0.25||s.y>SNAKE_H-0.25) return broke("You marched into the wall");
  // own formation: front rank vs every rank from the 3rd back (off during maneuvers)
  if(F.mode==="column" && !G.busy && !sol.some(s=>s.trans) && F.ranks.length>2){
    const front=F.ranks[0].sol.filter(Boolean);
    for(let r=2;r<F.ranks.length;r++) for(const b of F.ranks[r].sol) if(b) for(const a of front)
      if(Math.hypot(a.x-b.x,a.y-b.y)<0.55) return broke("You marched into your own formation");
  }
  if(G.pendingRecruits>0 && F.mode==="column" && !G.busy && F.ranks.every(rk=>rk.fs.every(onNewestSeg))){ G.pendingRecruits--; addRecruitToFormation(); }
  for(let i=G.recruits.length-1;i>=0;i--){
    const rc=G.recruits[i];
    if(sol.some(s=>Math.hypot(s.x-rc.x,s.y-rc.y)<0.7)){
      G.recruits.splice(i,1); G.score+=10; addRecruitToFormation(); spawnRecruit(); chime(true); updateHUD();
    }
  }
}
function broke(why){
  G.over=true; G.move="halt"; G.sched=[];
  if(G.score>hiScore){ hiScore=G.score; localStorage.setItem("formation.hi",hiScore); }
  $("ovTitle").textContent="Formation broke"; $("ovText").textContent=why+". Score "+G.score+" · High "+hiScore;
  $("overlay").classList.add("on"); chime(false); updateHUD();
  if(typeof stopListening==="function") stopListening();   // recording stops the moment the formation breaks
}

/* ======================================================================
   DRILL SERGEANT: centred on the formation's LEFT side (relative to the way it faces), 2 steps out
   from the left flank file, at the middle of its depth. Not part of the formation: no walls, no
   self-collision, can't pick up recruits. He walks in cadence (up to 1.3 steps per beat on post, double-timing up to 2 when relocating) and
   goes AROUND the nearer end of the formation, hugging it 1 step out, when the left side changes;
   during a counter column he starts for the new left side at once (rear march, flanks, facings).
====================================================================== */
const SGT_OUT=2, SGT_CLEAR=0.8;
function sgtFrame(hOverride){
  const sol=allSoldiers(); if(!sol.length) return null;
  let cx=0, cy=0, fx=0, fy=0;
  for(const s of sol){ cx+=s.x; cy+=s.y; fx+=Math.sin(s.face); fy+=-Math.cos(s.face); }
  cx/=sol.length; cy/=sol.length;
  const R=Math.hypot(fx,fy)/sol.length;
  let h = (G.sgt && (R<0.6 || F.mode==="counter")) ? G.sgt.h : Math.atan2(fx,-fy);   // mixed facings (counter column): keep the last facing
  if(!G.sgt && R<0.6) h=0;
  if(hOverride!==undefined) h=hOverride;
  const d=dirV(h), n=nrmV(h);
  let umin=1e9, umax=-1e9, vmin=1e9, vmax=-1e9;
  for(const s of sol){ const u=(s.x-cx)*d[0]+(s.y-cy)*d[1], v=(s.x-cx)*n[0]+(s.y-cy)*n[1];
    umin=Math.min(umin,u); umax=Math.max(umax,u); vmin=Math.min(vmin,v); vmax=Math.max(vmax,v); }
  return {cx,cy,h,d,n,umin,umax,vmin,vmax,sol};
}
const sgtXY=(fr,u,v)=>[fr.cx+fr.d[0]*u+fr.n[0]*v, fr.cy+fr.d[1]*u+fr.n[1]*v];
function sgtTarget(fr){ return sgtXY(fr,(fr.umin+fr.umax)/2, fr.vmin-SGT_OUT); }
function sgtInit(){
  G.sgt=null; const fr=sgtFrame(); if(!fr) return;
  const [x,y]=sgtTarget(fr);
  G.sgt={x,y,face:fr.h,h:fr.h,spd:0,px:x,py:y,route:"post",vf:[0,0],lc:[fr.cx,fr.cy]};
}
const SGT_HUG=1.0;     // clearance kept from the formation's edge while going around an end
/** Does segment a->b cross the formation box (expanded by c)? Coordinates are (u,v) in the formation frame. */
function sgtBlocked(fr,a,b,c){
  const x0=fr.umin-c, x1=fr.umax+c, y0=fr.vmin-c, y1=fr.vmax+c;
  let t0=0, t1=1; const dx=b[0]-a[0], dy=b[1]-a[1];
  for(const [pp,q] of [[-dx,a[0]-x0],[dx,x1-a[0]],[-dy,a[1]-y0],[dy,y1-a[1]]]){
    if(Math.abs(pp)<1e-9){ if(q<0) return false; continue; }
    const r=q/pp; if(pp<0){ if(r>t1) return false; if(r>t0) t0=r; } else { if(r<t0) return false; if(r<t1) t1=r; }
  }
  return t1-t0>1e-6;
}
/** Next point to walk to: straight to post if the way is clear, else hug the nearer end of the formation
    (corner points SGT_HUG outside its edge), whichever end makes the shorter walk. */
function sgtWaypoint(fr,S,T){
  const c=SGT_HUG, cb=c-0.06;
  if(!sgtBlocked(fr,S,T,cb)){ if(G.sgt) G.sgt.end=null; return {w:T, route:"post"}; }
  const vNear = S[1]>(fr.vmin+fr.vmax)/2 ? fr.vmax+c : fr.vmin-c;     // corner on his current side
  const vFar  = T[1]>(fr.vmin+fr.vmax)/2 ? fr.vmax+c : fr.vmin-c;     // corner on the post's side
  const D=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const opts=[fr.umax+c, fr.umin-c].map((uE,i)=>{
    const c1=[uE,vNear], c2=[uE,vFar];
    return !sgtBlocked(fr,S,c2,cb) ? {end:i, w:c2, len:D(S,c2)+D(c2,T)} : {end:i, w:c1, len:D(S,c1)+D(c1,c2)+D(c2,T)};
  });
  // stick with the end already chosen unless the other is clearly (2+ steps) shorter: no dithering
  const prev=G.sgt && G.sgt.end;
  let best = opts[0].len<opts[1].len ? opts[0] : opts[1];
  if(prev!==undefined && prev!==null && best.end!==prev && opts[prev].len < best.len+2) best=opts[prev];
  // counter column: commit to the old rear (= the new front, opts[0] in the new facing) for the whole maneuver
  if(F.mode==="counter") best = (prev!==undefined && prev!==null) ? opts[prev] : opts[0];
  G.sgt.end=best.end;
  return {w:best.w, route:"around"};
}
function sgtUpdate(dt){
  if(!G.sgt) return sgtInit();
  if(G.phase!=="formed"){ G.sgt.spd=0; return; }            // he waits on his post where the formation will form
  const S=G.sgt;
  // counter column: head for the NEW left side (the formation will face the other way) during the maneuver
  if(F.mode==="counter"){ if(S.ccH===undefined) S.ccH=S.h+Math.PI; } else S.ccH=undefined;
  const fr=sgtFrame(S.ccH); if(!fr) return;
  S.h=fr.h;
  const per=clock.period, full=G.tempo==="double"?1.2:1.0;
  const us=(S.x-fr.cx)*fr.d[0]+(S.y-fr.cy)*fr.d[1], vs=(S.x-fr.cx)*fr.n[0]+(S.y-fr.cy)*fr.n[1];
  const T=[(fr.umin+fr.umax)/2, fr.vmin-SGT_OUT];
  const {w,route}=sgtWaypoint(fr,[us,vs],T);
  let [tx,ty]=sgtXY(fr,w[0],w[1]);
  // while going around, ease the aim point (it jumps when the formation's outline changes shape mid-maneuver)
  if(route==="around" && S.aim && S.route==="around"){ const a=Math.min(1,dt/300); tx=lerp(S.aim[0],tx,a); ty=lerp(S.aim[1],ty,a); }
  S.aim=[tx,ty];
  let dx=tx-S.x, dy=ty-S.y; const dist=Math.hypot(dx,dy);
  const far = route==="around" || dist>1.5;
  // formation velocity (steps per ms), smoothed; he moves WITH it plus a straight approach to the waypoint,
  // so his path hugs the formation instead of bowing out while it marches away from him
  if(S.lc && dt>0){ let vx=(fr.cx-S.lc[0])/dt, vy=(fr.cy-S.lc[1])/dt; const vm=Math.hypot(vx,vy), vmax=1.5*full/per;
    if(vm>vmax){ vx=vx/vm*vmax; vy=vy/vm*vmax; } S.vf=[lerp(S.vf[0],vx,.3), lerp(S.vf[1],vy,.3)]; }
  if(!S.vf) S.vf=[0,0];
  S.lc=[fr.cx,fr.cy];
  const capV=(far?2.0:1.3)*full/per;                             // on post: up to 1.3 steps/beat; relocating: he double-times
  if(dist>1e-6){
    const ux=dx/dist, uy=dy/dist, vf=S.vf, fu=vf[0]*ux+vf[1]*uy, f2=vf[0]*vf[0]+vf[1]*vf[1];
    let k=-fu+Math.sqrt(Math.max(0, fu*fu-f2+capV*capV));       // approach speed that keeps |velocity| <= cap
    k=Math.max(0, Math.min(k, dist/dt));                          // no overshoot
    S.x+=(vf[0]+ux*k)*dt; S.y+=(vf[1]+uy*k)*dt;
  } else { S.x+=S.vf[0]*dt; S.y+=S.vf[1]*dt; }
  // never stand on a soldier
  for(let it=0;it<3;it++) for(const s of fr.sol){ const ex=S.x-s.x, ey=S.y-s.y, e=Math.hypot(ex,ey);
    if(e<SGT_CLEAR){ const k=(SGT_CLEAR-e)/(e||1); S.x+=(e?ex:-fr.n[0])*k; S.y+=(e?ey:-fr.n[1])*k; } }
  if(G.mode==="snake"){ S.x=clamp(S.x,0.3,SNAKE_W-0.3); S.y=clamp(S.y,0.3,SNAKE_H-0.3); }  // stays visible; walls only count for soldiers
  const dtBeats=dt/per;
  if(dtBeats>0){ const v=Math.hypot(S.x-S.px,S.y-S.py)/dtBeats; S.spd=lerp(S.spd,Math.min(v,2),.25); }
  S.px=S.x; S.py=S.y; S.route=route;
  const want = (route==="around" && dist>0.3) ? Math.atan2(dx,-dy) : fr.h;
  let da=((want-S.face)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI; S.face+=da*Math.min(1,dt/120);
}

/* ======================================================================
   BEFORE "FALL IN": soldiers scattered, strolling at random (no formation, so nothing can break).
   On FALL IN the base soldier (front rank, right file) sets first; the others hurry to their
   places on him, face front, dress right, ready front. Only then does the formation exist.
====================================================================== */
const STROLL_SPS=0.75, FORM_SPS=3.6;            // strolling; falling in at DOUBLE TIME (180 steps/min x 36-inch steps = 3.6 steps/s)
const DT_STRIDE=1.2;                             // double-time stride (36 in) in 30-inch steps
function scatterBounds(){
  return G.mode==="snake" ? {x0:1, y0:1, x1:SNAKE_W-1, y1:SNAKE_H-1} : {x0:-9, y0:-13, x1:9, y1:9};
}
function scatterStart(){
  G.phase="scatter"; G.recruits=[];
  const b=scatterBounds(), sol=allSoldiers(), placed=[];
  // the drill sergeant waits in a random corner, standing still, watching the soldiers
  if(G.sgt){ const S=G.sgt; S.post={x:S.x,y:S.y,h:S.h};
    const c=Math.floor(Math.random()*4), m=1.3;
    S.x = (c&1)? b.x1-m : b.x0+m; S.y = (c&2)? b.y1-m : b.y0+(G.mode==="snake"? 4.5 : m+2); S.px=S.x; S.py=S.y; S.spd=0; S.corner=c; S.arrived=false; }   // top corners: clear of the on-field buttons
  // each soldier remembers his formation slot (where layoutSoldiers just put him)
  for(const s of sol){
    let x,y,ok=false;
    for(let i=0;i<400 && !ok;i++){ x=b.x0+0.5+Math.random()*(b.x1-b.x0-1); y=b.y0+0.5+Math.random()*(b.y1-b.y0-1);
      ok = placed.every(p=>Math.hypot(p[0]-x,p[1]-y)>1.6) && !(G.sgt && Math.hypot(G.sgt.x-x,G.sgt.y-y)<2.5); }
    placed.push([x,y]);
    const h=Math.random()*Math.PI*2;
    s.x=x; s.y=y; s.face=h; s.px=null; s.py=null; s.spd=0; s.trans=null; s.faceAnim=null;
    s.wander={h, v:STROLL_SPS*(0.6+Math.random()*0.6), turnAt:now()+1000+Math.random()*3000, pauseUntil:0}; s.walkPh=Math.random()*2;
  }
}
/** "Fall in" during the scatter: assign slots (nearest soldier to the base slot first), then hurry in. */
function startFallIn(){
  if(G.phase!=="scatter") return false;
  if(G.sgt) G.sgt.walkTo=null;
  G.phase="forming"; G.formT0=now();
  const slots=[];
  F.ranks.forEach((rk,r)=>rk.sol.forEach((s,q)=>{ if(s){ const p=filePos(q,rk.fs[q]); slots.push({r,q,x:p.x,y:p.y,h:p.h}); } }));
  const base=slots.find(z=>z.r===0 && z.q===F.W-1) || slots[0];
  slots.sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y));   // base first, then outward
  const free=allSoldiers();
  for(const z of slots){
    let bi=0, bd=1e9; free.forEach((s,i)=>{ const d=Math.hypot(s.x-z.x,s.y-z.y); if(d<bd){bd=d;bi=i;} });
    const s=free.splice(bi,1)[0]; F.ranks[z.r].sol[z.q]=s;
    s.slot=z; s.arrived=false; s.isBase=(z===base); s.wander=null; makeSloppy(s);
    s.goAt = now() + (s.isBase? 0 : 250 + Math.random()*350);                // the base moves out first (double time)
  }
  if(G.sgt) G.sgt.goAt=now()+150;
  G.sloppy=true;
  flash("FALL IN","ok","Double time! The base soldier sets; the rest fall in on him");
  return true;
}
function scatterUpdate(dt){
  if(!G.phase || G.phase==="formed") return;
  const t=now(), sol=allSoldiers(), b=scatterBounds(), sec=dt/1000;
  for(const s of sol){
    let vx=0, vy=0;
    if(G.phase==="scatter"){
      const w=s.wander;
      if(t>w.turnAt){                                                 // wander: turn a little, sometimes stop to look around
        if(Math.random()<0.25) w.pauseUntil=t+800+Math.random()*1800;
        w.h+=(Math.random()-0.5)*Math.PI*0.9; w.turnAt=t+1500+Math.random()*3500;
      }
      if(t>=w.pauseUntil){
        // walls: turn back toward the field before touching them
        const m=0.8;
        if(s.x<b.x0+m) w.h=Math.PI/2+(Math.random()-0.5); else if(s.x>b.x1-m) w.h=-Math.PI/2+(Math.random()-0.5);
        if(s.y<b.y0+m) w.h=Math.PI+(Math.random()-0.5); else if(s.y>b.y1-m) w.h=(Math.random()-0.5);
        const d=dirV(w.h); vx=d[0]*w.v; vy=d[1]*w.v;
      }
      for(const o of sol){ if(o===s) continue; const ex=s.x-o.x, ey=s.y-o.y, e=Math.hypot(ex,ey);
        if(e<1.3 && e>1e-6){ const k=(1.3-e)*0.9; vx+=ex/e*k; vy+=ey/e*k; } }   // drift apart loosely
      if(G.sgt){ const ex=s.x-G.sgt.x, ey=s.y-G.sgt.y, e=Math.hypot(ex,ey); if(e<1.4 && e>1e-6){ vx+=ex/e*(1.4-e); vy+=ey/e*(1.4-e); } }
    } else {                                                          // forming
      const tg=slotTarget(s);
      if(s.arrived){ s.x=tg.x; s.y=tg.y; }
      else if(t>=s.goAt){
        const dx=tg.x-s.x, dy=tg.y-s.y, d=Math.hypot(dx,dy);
        if(d<0.06){ s.arrived=true; s.x=tg.x; s.y=tg.y; }
        else {
          const v=Math.min(FORM_SPS, d/sec*0.9); vx=dx/d*v; vy=dy/d*v;
          for(const o of sol){ if(o===s) continue; const ex=s.x-o.x, ey=s.y-o.y, e=Math.hypot(ex,ey);   // sidestep others
            if(e<0.7 && e>1e-6 && d>0.8){ const k=(0.7-e)*3; vx+=ex/e*k; vy+=ey/e*k; } }
        }
      }
    }
    s.x+=vx*sec; s.y+=vy*sec;
    if(G.mode==="snake"){ s.x=clamp(s.x,0.35,SNAKE_W-0.35); s.y=clamp(s.y,0.35,SNAKE_H-0.35); }
    const sp=Math.hypot(vx,vy), running=G.phase==="forming" && sp>1.2;
    s.run=running;
    s.spd=lerp(s.spd||0, running? 1.15 : Math.min(sp/1.6,1), .25);   // leg swing: strolling short, double time full
    s.walkPh=((s.walkPh||0)+(running? 3*sec : sp*sec/0.5))%2;       // own stride: strolling ~1.5/s, double time exactly 3/s (180/min)
    // face where he walks; once in his place, face the formation's front
    const want = (G.phase==="forming" && (s.arrived || Math.hypot(s.slot.x-s.x,s.slot.y-s.y)<0.4)) ? s.slot.h+(s.slop? s.slop.dh:0) : (sp>0.05 ? Math.atan2(vx,-vy) : s.face);
    let da=((want-s.face)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI; s.face+=da*Math.min(1,dt/180);
    s.px=s.x; s.py=s.y;
  }
  sgtPreFormUpdate(dt);
  if(G.phase==="forming" && sol.every(s=>s.arrived) && (!G.sgt || G.sgt.arrived) && !G.dressT){
    G.dressT=t;                                                      // no automatic dress: they just settle, ragged
  }
  if(G.dressT && t-G.dressT>400){ finishFallIn(); }
}
function finishFallIn(){
  G.dress=false; G.eyes=false; G.dressT=null; G.phase="formed";
  for(const s of allSoldiers()){ s.face=s.slot? s.slot.h : s.face; s.slot=null; s.arrived=null; s.wander=null; s.spd=0; s.px=null; s.py=null; }
  layoutSoldiers(0,true);
  if(G.sgt){ const S=G.sgt; S.vf=[0,0]; S.lc=null; S.run=false; S.spd=0; S.goAt=null; if(S.post){ S.x=S.post.x; S.y=S.post.y; S.face=S.post.h; S.px=S.x; S.py=S.y; } S.post=null; }
  if(G.mode==="snake") spawnRecruits();
  updateHUD(); setStateTag();
  flash("FORMED UP (RAGGED)","ok",'Call "COVER", then "RECOVER" to straighten them. Then "Forward… MARCH!"');
}

/** FALL OUT: the formation dissolves where it stands. Soldiers wander (pre-Fall-in behaviour), the drill
    sergeant WALKS to a new random corner and watches. Score is kept (paused: no recruits, no walls). A fresh
    4-wide formation at normal interval is what the next FALL IN forms on. */
function fallOut(){
  const old=allSoldiers().map(s=>({x:s.x,y:s.y,face:s.face})), n=old.length;
  const S0=G.sgt && {x:G.sgt.x, y:G.sgt.y, face:G.sgt.face, corner:G.sgt.corner};
  if(G.mode==="snake") F=makeFormation(SNAKE_W/2, Math.round(SNAKE_H*0.6), 0, 4, n); else F=makeFormation(0,0,0,4,n);
  layoutSoldiers(0,true);
  Object.assign(G, {move:"halt", tempo:"quick", posture:"attention", dress:false, eyes:false, sched:[], hitch:false, busy:null, prevMove:"forward",
    recruits:[], pendingRecruits:0, cover:null, sloppy:false, dressT:null, nstep:null, phase:"scatter"});
  sgtInit();
  const b=scatterBounds();
  allSoldiers().forEach((s,i)=>{ const o=old[i]; s.x=o.x; s.y=o.y; s.face=o.face; s.px=null; s.py=null; s.spd=0; s.trans=null; s.faceAnim=null;
    s.slop=null; s.slopK=1; s.arm=null; s.shuffle=false; s.slot=null; s.arrived=null;
    const h=o.face+(Math.random()-0.5)*Math.PI*1.2;
    s.wander={h, v:STROLL_SPS*(0.6+Math.random()*0.6), turnAt:now()+600+Math.random()*2500, pauseUntil:now()+Math.random()*500}; s.walkPh=Math.random()*2; });
  if(G.sgt){ const S=G.sgt; S.post={x:S.x,y:S.y,h:S.h};
    let c; do{ c=Math.floor(Math.random()*4); } while(S0 && c===S0.corner);
    const m=1.3; S.walkTo={x:(c&1)? b.x1-m : b.x0+m, y:(c&2)? b.y1-m : b.y0+(G.mode==="snake"? 4.5 : m+2)}; S.corner=c;
    if(S0){ S.x=S0.x; S.y=S0.y; S.face=S0.face; } S.px=S.x; S.py=S.y; S.spd=0; S.arrived=false; }
  updateHUD(); setStateTag();
  flash("FALL OUT","ok",'They break ranks and wander. Score kept. Say "Fall in" to form them up again.');
}
const SGT_WALK_SPS=1.5;   // the drill sergeant walks (not double time) to his corner after FALL OUT
/** Drill sergeant before the formation exists: still in his corner watching the group; on FALL IN he
    double-times to his post on the formation's LEFT flank, centred. */
function sgtPreFormUpdate(dt){
  const S=G.sgt; if(!S || !S.post) return;
  const sol=allSoldiers(), sec=dt/1000;
  let cx=0, cy=0; sol.forEach(o=>{cx+=o.x; cy+=o.y;}); cx/=sol.length||1; cy/=sol.length||1;
  let want=S.face, vx=0, vy=0;
  let walking=false;
  if(G.phase==="scatter" && S.walkTo){                                       // after FALL OUT: walk to his new corner
    const dx=S.walkTo.x-S.x, dy=S.walkTo.y-S.y, d=Math.hypot(dx,dy);
    if(d<0.05){ S.x=S.walkTo.x; S.y=S.walkTo.y; S.walkTo=null; }
    else { const v=Math.min(SGT_WALK_SPS, d/sec); vx=dx/d*v; vy=dy/d*v; want=Math.atan2(vx,-vy); walking=true; }
  }
  if(G.phase==="scatter" && !walking) want=Math.atan2(cx-S.x, -(cy-S.y));    // watching the group
  if(G.phase==="forming" && !S.arrived && now()>=(S.goAt||0)){
    const dx=S.post.x-S.x, dy=S.post.y-S.y, d=Math.hypot(dx,dy);
    if(d<0.06){ S.arrived=true; S.x=S.post.x; S.y=S.post.y; }
    else { const v=Math.min(FORM_SPS, d/sec*0.9); vx=dx/d*v; vy=dy/d*v;
      for(const o of sol){ const ex=S.x-o.x, ey=S.y-o.y, e=Math.hypot(ex,ey);
        if(e<0.8 && e>1e-6 && d>0.9){ const k=(0.8-e)*3; vx+=ex/e*k; vy+=ey/e*k; } }
      want=Math.atan2(vx,-vy); }
  }
  if(S.arrived) want=S.post.h;
  S.x+=vx*sec; S.y+=vy*sec;
  const sp=Math.hypot(vx,vy); S.run=sp>1.2;
  S.spd=lerp(S.spd||0, S.run?1.15: walking? 0.8 : 0, .25); S.walkPh=((S.walkPh||0)+(S.run? 3*sec : walking? sp*sec/0.75 : 0))%2;
  let da=((want-S.face)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI; S.face+=da*Math.min(1,dt/200);
  S.px=S.x; S.py=S.y;
}

/* ======================================================================
   DISHEVELED FALL-IN, COVER and RECOVER (TC 3-21.5: in column at the halt, COVER aligns each Soldier
   directly behind the man in front at the correct distance, arms raised; RECOVER returns to attention).
   The raggedness is a DRAW-ONLY offset (s.slop): s.x/s.y stay on the true grid, so walls, own-formation
   checks and recruit pickup never see it and it can never cause a false "formation broke".
====================================================================== */
const COVER_MS=1500;
function rnd(a){ return (Math.random()*2-1)*a; }
function makeSloppy(s){
  const mag=(a,m)=>{ let v=rnd(a); if(Math.abs(v)<m) v=(v<0?-1:1)*m; return v; };   // visibly off, still readable
  s.slop={dx:mag(0.24,0.07), du:mag(0.2,0.05), dh:rnd(12)*D2R, ph:Math.random()*Math.PI*2};
  s.slopK=1;
}
function dishevel(){ for(const s of allSoldiers()) makeSloppy(s); G.sloppy=true; G.cover=null; }
/** Where a sloppy soldier actually stands during the form-up (true slot + his offset). */
function slotTarget(s){
  const z=s.slot, o=s.slop; if(!o) return {x:z.x,y:z.y};
  const d=dirV(z.h), n=nrmV(z.h);
  return {x:z.x+n[0]*o.dx+d[0]*o.du, y:z.y+n[1]*o.dx+d[1]*o.du};
}
/** Visual offset for drawing: [dx, dy, dFace]. Marching ragged = the offsets breathe a little. */
function visOff(s){
  const o=s.slop; if(!o || !(G.phase==="formed" || s.arrived)) return [0,0,0];
  const k=s.slopK===undefined?1:s.slopK, t=now(), per=(clock&&clock.period)||500;
  const m = G.phase==="formed" && marching();
  const w = m ? 1+0.35*Math.sin(t/(per*2.3)+o.ph) : 1;
  const bob = m ? 0.06*Math.sin(t/(per*1.3)+o.ph*1.7) : 0;
  const d=dirV(s.face), n=nrmV(s.face), lat=(o.dx*w+bob)*k, fwd=o.du*w*k;
  return [n[0]*lat+d[0]*fwd, n[1]*lat+d[1]*fwd, o.dh*k];
}
/** Which arm each soldier raises at COVER, relative to the formation's facing (LEFT arm, shoulder height):
    front rank holds it straight out to the LEFT side, except the front-left corner man (nobody to his left);
    everyone behind holds it straight forward toward the man ahead. s.armReach = distance (centre to centre)
    to the man the arm points at, so the drawn arm stops a tiny gap short of him. */
function assignArms(){
  const sol=allSoldiers(); if(!sol.length) return;
  let fx=0, fy=0; for(const s of sol){ fx+=Math.sin(s.face); fy+=-Math.cos(s.face); }
  const h=Math.atan2(fx,-fy), d=dirV(h), n=nrmV(h);
  const fw=s=>s.x*d[0]+s.y*d[1], rt=s=>s.x*n[0]+s.y*n[1];
  const maxF=Math.max(...sol.map(fw));
  const front=sol.filter(s=>fw(s)>maxF-0.5);
  const minR=Math.min(...front.map(rt));
  for(const s of sol){
    let reach=Infinity;
    if(front.includes(s)){
      s.arm = rt(s)<minR+0.3 ? null : "lat";
      for(const o of front) if(o!==s && rt(o)<rt(s)-0.3) reach=Math.min(reach, Math.hypot(o.x-s.x,o.y-s.y));
    } else {
      s.arm="fwd";
      for(const o of sol) if(o!==s && Math.abs(rt(o)-rt(s))<0.4 && fw(o)>fw(s)+0.3) reach=Math.min(reach, Math.hypot(o.x-s.x,o.y-s.y));
    }
    // true grid distance (the interval may be changing right now): lateral = interval, forward = rank distance
    s.armReach = isFinite(reach) ? (s.arm==="lat" ? F.interval : F.rankDist) : 1;
  }
}
/* ---------- Interval about the right file: the right flank file stands fast, the others move ---------- */
const NORMAL_IV=1;
/** Close interval: elbow (right hand on hip) touches the left side of the man to the right. In steps, centre to centre. */
const CLOSE_IV=0.75;   // ≈ 4 in between shoulders (22 in centre to centre, 30-in step)
function setIntervalRightFixed(iv, dur){
  if(Math.abs(F.interval-iv)<1e-9) return false;
  const old=allSoldiers().map(s=>[s,s.x,s.y]);
  const L0=laneOf(F.W-1);                       // right file's lane offset stays put
  F.interval=iv; F.cShift=L0/iv-(F.W-1)/2; F._fi=null;
  for(const [s,x,y] of old) s.trans={x,y,t0:now(),dur:dur||COVER_MS*0.8};
  return true;
}
/* F.closeIv = {prev, axis}: the formation is at close interval; prev = the interval before it closed.
   A facing/flank turns files into ranks, so the closed spacing becomes the distance (axis "rankDist") and back. */
function startCloseInterval(){
  for(const s of allSoldiers()){ s.arm="hip"; s.armReach=null; }
  if(!(F.closeIv && F.closeIv.axis==="interval")) F.closeIv={prev:F.interval, axis:"interval"};
  setIntervalRightFixed(CLOSE_IV);
  G.cover={t0:now(), hold:false, kind:"hip"};
  for(const s of allSoldiers()){ if(!s.slop) s.slop=null; s.coverDelay=Math.random()*0.25; s.slopK0=s.slop?(s.slopK===undefined?1:s.slopK):0; s.shuffle=true; }
  setStateTag && setStateTag();
}
/** Normal interval, MARCH: back to the interval before At close interval (right file fixed). Spacing only:
    ragged soldiers stay ragged (COVER is what straightens them). */
function normalInterval(){
  const C=F.closeIv; if(!C) return;
  setIntervalRightFixed(C.prev); F.closeIv=null;
  const until=now()+COVER_MS*0.8; for(const s of allSoldiers()) s.shuffleUntil=until;
}
/** Undo close interval on whichever axis it is on now (used by COVER, which replaces Normal interval). */
function restoreFromClose(){
  const C=F.closeIv; if(!C) return;
  if(C.axis==="interval") setIntervalRightFixed(C.prev);
  else { animateSpacing("rankDist", C.prev); for(const s of allSoldiers()) if(s.trans) s.trans.dur=COVER_MS*0.8; }
  F.closeIv=null;
}
function startCover(){
  restoreFromClose();
  assignArms();
  G.cover={t0:now(), hold:false, kind:"cover"};
  for(const s of allSoldiers()){ if(!s.slop) s.slop=null; s.coverDelay=Math.random()*0.25; s.slopK0=s.slop?(s.slopK===undefined?1:s.slopK):0; }
  setStateTag && setStateTag();
}
function coverUpdate(){
  const C=G.cover; if(!C || C.hold) return;
  const u=(now()-C.t0)/COVER_MS;
  for(const s of allSoldiers()){
    if(!s.slop){ if(C.kind==="hip") s.shuffle = u<0.8; continue; }
    const v=clamp((u-s.coverDelay)/0.7,0,1);
    s.slopK=s.slopK0*(1-ease(v)); s.shuffle = v>0 && v<1;           // small shuffling steps while adjusting
  }
  if(u>=1){ for(const s of allSoldiers()){ s.slop=null; s.slopK=1; s.shuffle=false; } G.sloppy=false; C.hold=true; }
}
function doRecover(){
  for(const s of allSoldiers()){ s.slop=null; s.slopK=1; s.shuffle=false; s.arm=null; }
  G.cover=null; G.sloppy=false; G.posture="attention";
  setStateTag && setStateTag();
}
