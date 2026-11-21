"use strict";
/* ---------- Small helpers ---------- */
const $ = id => document.getElementById(id);
const D2R = Math.PI/180;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const ease = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
// Heading h is in radians: 0 = north (screen up), positive = clockwise (to the right).
const dirV = h => [Math.sin(h), -Math.cos(h)];
const nrmV = h => [Math.cos(h), Math.sin(h)];          // right-hand normal
let simNow = null;                                        // virtual clock for automated tests
const now = () => simNow ?? performance.now();
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");

/* ======================================================================
   PATH: the line of march, made of straight and arc segments. Each
   rank's centre sits at an arc length `s` along it, so every rank turns
   at the same pivot point, as in real drill. Arcs carry a speed factor:
   the OUTSIDE file keeps a full 30-inch step while the pivot file takes
   short (half) steps.
====================================================================== */
class Path {
  constructor(){ this.segs = []; }
  static straight(x,y,h){ const p=new Path(); p.segs.push({t:"L",x,y,h,s0:0,len:Infinity,f:1}); return p; }
  static fromPoints(pts){ // polyline (used for reversed paths and counter-column file paths)
    const p=new Path(); let s=0;
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
      if(len<1e-6) continue;
      p.segs.push({t:"L",x:a[0],y:a[1],h:Math.atan2(dx,-dy),s0:s,len,f:1}); s+=len;
    }
    return p;
  }
  get last(){ return this.segs[this.segs.length-1]; }
  segAt(s){
    const g=this.segs; let lo=0, hi=g.length-1;
    while(lo<hi){ const m=(lo+hi+1)>>1; if(g[m].s0<=s) lo=m; else hi=m-1; }
    return g[lo];
  }
  posAt(s){
    const g=this.segAt(s), u=s-g.s0;
    if(g.t==="L" || u<0){ const d=dirV(g.h); return {x:g.x+d[0]*u, y:g.y+d[1]*u, h:g.h}; } // u<0: extrapolate behind start
    if(u>g.len){ const e=this.arcPoint(g,g.len), d=dirV(e.h), v=u-g.len; return {x:e.x+d[0]*v,y:e.y+d[1]*v,h:e.h}; }
    return this.arcPoint(g,u);
  }
  arcPoint(g,u){ const h=g.h+g.d*u/g.r, n=nrmV(h); return {x:g.cx-g.d*n[0]*g.r, y:g.cy-g.d*n[1]*g.r, h}; }
  factorAt(s){ const g=this.segAt(s); return (s-g.s0<=g.len)? g.f : 1; }
  /** Cut the open-ended last line at sCut, then append items
      {t:"A", ang, r, d(+1 right/-1 left), f} or {t:"L", len}. Always ends with an infinite line. */
  append(sCut, items){
    const L=this.last;
    if(L.len===Infinity){ if(sCut<L.s0) sCut=L.s0; L.len=sCut-L.s0; } else sCut=L.s0+L.len;
    let cur=sCut, p=this.posAt(sCut);
    for(const it of items){
      if(it.t==="T"){ p={x:p.x,y:p.y,h:p.h+it.d*it.ang}; continue; }   // sharp corner (square pivot)
      if(it.t==="A"){
        const n=nrmV(p.h), seg={t:"A",x:p.x,y:p.y,h:p.h,r:it.r,d:it.d,s0:cur,len:it.ang*it.r,f:it.f??1,
          cx:p.x+it.d*n[0]*it.r, cy:p.y+it.d*n[1]*it.r};
        this.segs.push(seg); cur+=seg.len; p=this.arcPoint(seg,seg.len);
      } else {
        const seg={t:"L",x:p.x,y:p.y,h:p.h,s0:cur,len:it.len,f:1};
        this.segs.push(seg); if(it.len===Infinity) return;
        cur+=it.len; const d=dirV(p.h); p={x:p.x+d[0]*it.len,y:p.y+d[1]*it.len,h:p.h};
      }
    }
    this.segs.push({t:"L",x:p.x,y:p.y,h:p.h,s0:cur,len:Infinity,f:1});
  }
  translate(dx,dy){ for(const g of this.segs){ g.x+=dx; g.y+=dy; if(g.t==="A"){ g.cx+=dx; g.cy+=dy; } } }
  prune(sMin){ while(this.segs.length>2 && this.segs[1].s0 < sMin) this.segs.shift(); } // keep memory bounded
}

/* ======================================================================
   COMMAND TABLE: one source of truth for parsing, rules, and the
   reference screen.
   exec: class of the command-of-execution word.
   foot: L | R | either | null (not marching)
   when: "march" (marching only) | "halt" (at the halt only) | "any"
====================================================================== */
const UNIT = "(?:squad|squat|squads|platoon|plato|platoons|flight|flights|fight|company|detail|element|team|section|class|formation|unit|troop|troops)";
const COL  = "(?:colum|column|columns|colin|collum|calm|call|colon|kolam|calum|culm|com)";
const RIGHT= "(?:right|write|rite|ride|wright|ryte|rights|rice)";
const LEFT = "(?:left|lift|lef|laughed|lefts)";
const HALF = "(?:half|have|haf|hav|halves)";
const STEP = "(?:step|steps|stop|stepped)";
const CMDS = [
  {id:"counter", name:"Counter column, MARCH", exec:"MARCH", re:"counter|encounter", foot:"either", when:"any",
   desc:"The formation reverses inside its own frontage. 1st squad takes 3 steps and turns column right twice. 2nd squad takes 1 step and turns column right twice. 3rd squad turns column left twice. 4th squad takes 2 steps and turns column left twice. Squads that finish first half-step until all are abreast. Needs 4 files."},
  {id:"colHR", name:"Column half right, MARCH", exec:"MARCH", re:HALF+"\\s*"+RIGHT, foot:"R", when:"any", desc:"One more step, then the front rank pivots 45° right. Every rank wheels at the same point."},
  {id:"colHL", name:"Column half left, MARCH", exec:"MARCH", re:HALF+"\\s*"+LEFT, foot:"L", when:"any", desc:"One more step, then the front rank pivots 45° left. Every rank wheels at the same point."},
  {id:"colR", name:"Column right, MARCH", exec:"MARCH", re:COL+"\\s*"+RIGHT, foot:"R", when:"any", desc:"One more step. The right file pivots 90° right and half-steps while the other files wheel until abreast, then everyone takes full steps. Every rank turns at the same pivot point."},
  {id:"colL", name:"Column left, MARCH", exec:"MARCH", re:COL+"\\s*"+LEFT, foot:"L", when:"any", desc:"Mirror of Column right. The left file pivots and half-steps while the right files wheel up."},
  {id:"rflank", name:"Right flank, MARCH", exec:"MARCH", re:RIGHT+"\\s*(?:flank|flake|flanks|frank|plank|thank)", foot:"R", when:"march", desc:"One more step. Everyone pivots 90° right on the ball of the left foot and steps off. Ranks become files."},
  {id:"lflank", name:"Left flank, MARCH", exec:"MARCH", re:LEFT+"\\s*(?:flank|flake|flanks|frank|plank|thank)", foot:"L", when:"march", desc:"One more step. Everyone pivots 90° left and steps off. Ranks become files."},
  {id:"rstep", name:"Right step, MARCH", exec:"MARCH", re:RIGHT+"\\s*"+STEP, foot:null, when:"halt", desc:"From the halt only. 15-inch steps to the right; the formation keeps its facing. Platoon, HALT stops it."},
  {id:"lstep", name:"Left step, MARCH", exec:"MARCH", re:LEFT+"\\s*"+STEP, foot:null, when:"halt", desc:"From the halt only. 15-inch steps to the left."},
  {id:"back", name:"Backward, MARCH", exec:"MARCH", re:"back\\s*wards?|backward|backwords|back word", foot:null, when:"halt", desc:"From the halt only. 15-inch steps to the rear; facing doesn't change."},
  {id:"rear", name:"Rear, MARCH", exec:"MARCH", re:"(?:^|\\s)(?:rear|rare|rhea|reer|wear|year|ear|rehr|real|rears)$", foot:"R", when:"march", desc:"Called as the right foot strikes. One more step with the left, pivot 180° right on the balls of both feet, step off with the left. The rear rank becomes the front rank."},
  {id:"mark", name:"Mark time, MARCH", exec:"MARCH", re:"(?:mark|marc|marked|market|mart)\\s*(?:time|tim|tom|times)", foot:"either", when:"any", desc:"One more step, then march in place. The cadence continues. Forward, MARCH resumes."},
  {id:"halfstep", name:"Half step, MARCH", exec:"MARCH", re:HALF+"\\s*"+STEP, foot:"either", when:"march", desc:"Shorten to 15-inch steps at the same cadence. Forward, MARCH resumes 30-inch steps."},
  {id:"change", name:"Change step, MARCH", exec:"MARCH", re:"(?:change|chain|changed|chang)\\s*"+STEP, foot:"R", when:"march", desc:"Called as the right foot strikes. One more step with the left, ball of the right foot next to the left heel, then step off with the left (a hitch step)."},
  {id:"double", name:"Double time, MARCH", exec:"MARCH", re:"(?:double|dubble|doubled)\\s*(?:time|tim|times)", foot:"either", when:"any", desc:"One more 30-inch step, then double time: 180 steps per minute, 36-inch steps."},
  {id:"quick", name:"Quick time, MARCH", exec:"MARCH", re:"(?:quick|quik|kwik)\\s*(?:time|tim|times)", foot:"either", when:"march", desc:"Back to quick time (normal cadence, 30-inch steps)."},
  {id:"openranks", name:"Open ranks, MARCH", exec:"MARCH", re:"open\\s*(?:ranks?|rings|rank's)", foot:null, when:"halt", desc:"At the halt. Ranks open to double distance. The 3rd rank stands fast; ranks ahead step forward and ranks behind step back."},
  {id:"closeranks", name:"Close ranks, MARCH", exec:"MARCH", re:"close\\s*(?:ranks?|rings|rank's)", foot:null, when:"halt", desc:"At the halt. Ranks close back to normal distance."},
  {id:"extend", name:"Extend, MARCH", exec:"MARCH", re:"extend|extent|extended", foot:"either", when:"any", desc:"Files extend from close interval back to normal interval."},
  {id:"close", name:"Close, MARCH", exec:"MARCH", re:"(?:^|\\s)(?:close|clothes|closed|clove)$", foot:"either", when:"any", desc:"Files close to close interval (4 inches between soldiers)."},
  {id:"forward", name:"Forward, MARCH", exec:"MARCH", re:"forward|for word|foreword|forwards|four word", foot:"either", when:"any", desc:"From the halt: step off with the left foot. From mark time or half step: resume 30-inch steps."},
  {id:"halt", name:"Platoon / Squad / Flight, HALT", exec:"HALT", re:UNIT, foot:"either", when:"march", desc:"Two counts: one more step, then bring the trailing foot alongside."},
  {id:"attn", name:"Platoon, ATTENTION", exec:"ATTN", re:UNIT, foot:null, when:"halt", desc:"Snap to attention from any rest. Required before moving on Standard and Drill Sergeant."},
  {id:"rface", name:"Right, FACE", exec:"FACE", re:"(?:^|\\s)"+RIGHT+"$", foot:null, when:"halt", desc:"Pivot 90° right on the right heel and left ball, then bring the left foot alongside. Ranks become files."},
  {id:"lface", name:"Left, FACE", exec:"FACE", re:"(?:^|\\s)"+LEFT+"$", foot:null, when:"halt", desc:"Pivot 90° left. Ranks become files."},
  {id:"aface", name:"About, FACE", exec:"FACE", re:"about|a bout|bout|abouts", foot:null, when:"halt", desc:"Right toe half a foot length behind the left heel, then pivot 180° to the right. The formation faces the rear."},
  {id:"parade", name:"Parade, REST", exec:"REST", re:"parade|prade|per aid|parades|para", foot:null, when:"halt", desc:"Left foot 10 inches to the left, hands at the small of the back."},
  {id:"standease", name:"Stand at, EASE", exec:"EASE", re:"stand", foot:null, when:"halt", desc:"Like parade rest, but every Soldier turns his head and eyes to the drill sergeant and follows him. The look ends at Parade rest, Attention, or any movement."},
  {id:"atease", name:"AT EASE", exec:"ATEASE", re:"", single:true, foot:null, when:"halt", desc:"No effect in this game (no change and no \"!\")."},
  {id:"dress", name:"Dress right, DRESS", exec:"DRESS", re:RIGHT, foot:null, when:"halt", desc:"Heads and eyes right (except the right file). Left arms extended to the left, stopping just short of the next man, by every file except the left file. Soldiers align on the right file."},
  {id:"eyes", name:"Eyes, RIGHT", exec:"RIGHT", re:"(?:^|\\s)(?:eyes|eye|ice|i's|ayes|i)$", foot:"R", when:"any", desc:"Heads and eyes 45° right. While marching, the right file keeps looking to the front. Called as the right foot strikes."},
  {id:"front", name:"Ready, FRONT", exec:"FRONT", re:"ready|reddy|readi", foot:"L", when:"any", desc:"Ends Dress right or Eyes right. Called as the left foot strikes when marching."},
  {id:"closeint", name:"At close interval, MARCH", exec:"MARCH", re:"close\\s*intervals?$", foot:null, when:"halt", desc:"At the halt. Every Soldier puts his RIGHT hand on his right hip, right elbow out to the right, touching the left side of the man to his right (no gap; the right-file man's elbow touches nothing). The right file stands fast; the others shuffle in toward it and align exactly. RECOVER drops the arms; the formation stays at close interval until Normal interval, COVER, or FALL IN."},
  {id:"normint", name:"Normal interval, MARCH", exec:"MARCH", re:"normal\\s*intervals?$", foot:null, when:"halt", desc:"At the halt, only after At close interval. The right file stands fast and the others shuffle back out to the interval they had before At close interval. It only changes the interval: it does not straighten a ragged formation (that's COVER). COVER at close interval also restores normal interval."},
  {id:"cover", name:"COVER", exec:"COVER", re:"", single:true, foot:null, when:"halt", desc:"At the halt, in column. Left arms up at shoulder height: the front rank holds it straight out to the left side (except the front-left corner man, who has nobody to his left), everyone behind holds it straight forward toward the man ahead, stopping just short of him. Each Soldier aligns directly behind the man in front at the correct distance and holds until RECOVER."},
  {id:"recover", name:"RECOVER", exec:"RECOVER", re:"", single:true, foot:null, when:"halt", desc:"Ends COVER: arms snap down to the sides, back to attention, aligned. Only valid after COVER."},
  {id:"nsteps", name:"(1–4) steps to the Right/Left, MARCH", exec:"MARCH", re:"", foot:null, when:"halt", desc:"From the halt at attention only. The formation takes 1 to 4 fifteen-inch steps to the right or left, keeps its facing, and halts on its own. Any other count (0, 5 or more, none) or direction, or calling it at any other moment, is a \"!\" and nothing moves."},
  {id:"fallout", name:"Fall, OUT", exec:"OUT", re:"", single:true, foot:null, when:"halt", desc:"At the halt, formed. The formation dissolves: soldiers break ranks and wander out of step (walls and bumps can't break anything), the drill sergeant walks to a new corner and watches. Score is kept, paused, no recruits. Call FALL IN to form up again (ragged, normal interval)."},
  {id:"fallin", name:"Fall, IN", exec:"IN", re:"fall", foot:null, when:"any", desc:"Forms the platoon in column at attention. Resets position, and restarts after Formation Broke."},
];
const CMD = Object.fromEntries(CMDS.map(c=>[c.id,c]));

/* ======================================================================
   SPEECH PARSER: tolerant of how Chrome (especially on Android) mishears
   drill commands. Steps:
   1. normalise (lowercase, strip punctuation, numbers to words)
   2. rewrite known multi-word mishearings ("call him left" -> "column left")
   3. map every token to a canonical drill keyword (word lists + 1-letter typos)
   4. find the command of execution near the end, then match the preparatory
      words in front of it against each command's patterns (either word order
      for flanks and columns).
====================================================================== */
const EXEC_WORDS = {
  MARCH:["march","mar","marsh","marge","much","mars","harch","hutch","hut","ho","hoe","hah","huh","arch","mash","match","marched","marching","martch","mosh","hoch","harsh","mach","marches","march's","mush","marsha","mars'","mark","marc","larch","parch","starch","hush","hup","hop","harsh"],
  HALT:["halt","hlt","hallt","salt","fault","hold","holt","hall","haul","alt","hault","hult","hoult","halts","holds","hawk","hot","whole","hole","haunt","holt's","halt's"],
  FACE:["face","fay","fah","faith","phase","fase","fays","faced","faces","fate","fake","vase","case","base","space"],
  REST:["rest","wrest","rust","ress","rests","rested","wrist","arrest","west","rast"],
  EASE:["ease","ees","easy","eese","these","e's","is","ez","eaze","cheese"],
  DRESS:["dress","dres","drez","dressed","dresses","jess","press","chess","trust","dross"],
  FRONT:["front","frunt","fronts","fron","frant","frog","friend","fruit","blunt","runt"],
  RIGHT:["right","rite","write","wright","ride","rights","alright"],
  ATTN:["attention","tension","tenshun","attenshun","attentions","detention","intention"],
};
const EXEC_LOOKUP = {};
for(const [k,arr] of Object.entries(EXEC_WORDS)) for(const w of arr) (EXEC_LOOKUP[w]=EXEC_LOOKUP[w]||[]).push(k);

/* canonical keyword -> heard variants (single tokens) */
const KEYWORDS = {
  column:["column","columns","palm","palms","cumm","cum","colm","clem","come","comm","kolm","colm","culm","calmer","com","kom","colum","collum","colm","colin","collin","colon","colonel","columbus","calm","calum","culm","kolam","colleen","coleman","column's","kollum","kolumn","volume","collar","colour","color","collins","colin's","cologne","collie","collect"],
  counter:["counter","encounter","counters","countered","counter's","contra","counting","county","canter","cantor","counted","countr","kounter","quarter"],
  half:["half","have","haf","hav","halves","haff","huff","hof","hath","halfe","half's","calf","hat"],
  left:["left","laugh","lift","lef","laughed","lefts","loft","leff","lest","lyft","lept","laughs","lefty","lifts","leaf","let","lap"],
  right:["right","ri","rai","righ","write","rite","ride","wright","ryte","rights","rice","alright","bright","wright's","rye","writes","rides","fright","ripe","white"],
  flank:["flank","flanks","flake","flakes","frank","franks","plank","planks","thank","thanks","flang","flanked","blank","flack","flak","flunk","flonk","flick","flex","flinch","plunk","clank","flag"],
  step:["step","steps","stop","stepped","stab","stomp","stuff","stap","stepp","stops","stem"],
  rear:["rear","rare","reah","rea","reeah","rearh","rhea","reer","rehr","real","rears","rear's","rier","rearr","reared","rearing","raw","ream","reed","roar"],
  rearWeak:["wear","year","ear","here","hear","near","re","ree","ria","rio","rae","ray","reel","rey","ria","beer","deer","mere","clear","rhee"],
  mark:["mark","marc","marked","market","mart","marks","marques","marquee","mork","mock","marx"],
  time:["time","tim","tom","times","thyme","tine","dime","tie","timer","team","tyme","tyne","tight"],
  change:["change","chain","changed","chang","chains","changes","exchange","shane","chainge","jane"],
  double:["double","dubble","doubled","bubble","doubles","dabble","duffel","dub"],
  quick:["quick","quik","kwik","quit","quake","quicker","kick","wick","quickly"],
  open:["open","opened","opens","opin","hoping","opun"],
  close:["close","clothes","closed","clove","cloves","clothe","cloze","clows","claus","klaus","clause"],
  ranks:["ranks","rank","rings","rank's","rinks","rants","wrinks","ranch","rang","rangs","racks"],
  interval:["interval","intervals","interval's","intervale","intaval","intervol","innerval","interfal"],
  normal:["normal","normally","normals","mormal","nermal"],
  extend:["extend","extent","extended","extends","extents","x10","xtend","attend","excellent"],
  forward:["forward","foreword","forwards","forword","fourward","forwad","forwarded","forewarned","onward"],
  backward:["backward","backwards","backwords","backword","backwoods"],
  about:["about","bout","abouts","abound","a-bout","abode","abort","about's"],
  parade:["parade","prade","parades","para","parader","pirate","parody","brigade","paraded","per-raid","parrot"],
  stand:["stand","stan","stands","stamp","standing","stan's"],
  at:["at","and","add","ad","an"],
  ready:["ready","reddy","readi","redi","readie","reading","read","red","rudy","betty","eddie","freddy","readying"],
  eyes:["eyes","eye","ice","ayes","i","i's","ais","eyes'","eyed","is","eyez"],
  fall:["fall","falls","fault","foal","fol","fawn"],
  in:["in","inn","end","and"],
};
const UNIT_WORDS = ["squad","squat","squads","platoon","plato","platoons","flight","flights","fight","company","detail","element","team","section","class","formation","unit","troop","troops","platoon's","squad's","squid","play","toon","patoon","platune","flite","flyte","group"];
const FILLER = new Set(["uh","um","ah","er","erm","the","a","okay","ok","now","and","go","so","like","hey","yo","please"]);
const KW_LOOKUP = {};  // token -> [canonical keywords]
for(const [k,arr] of Object.entries(KEYWORDS)) for(const w of arr) (KW_LOOKUP[w]=KW_LOOKUP[w]||[]).push(k);
const UNIT_SET = new Set(UNIT_WORDS);
// Words long enough that a one-letter slip is still unambiguous
const FUZZY_KW = ["column","counter","forward","backward","change","double","extend","parade","flank","ranks","about","quick","ready","platoon"];
function lev(a,b){ if(Math.abs(a.length-b.length)>1) return 9; const m=a.length,n=b.length; let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; } return prev[n]; }

/* multi-word mishearings, applied to the normalised string */
const REWRITES = [
  [/\b(?:call|cole|coal|cold|col|kohl|cal|car|collar|calling|calls|coll|kol) (?:him|em|them|um|om|um's|him's|ham|a?m|on|in|lum|loom|loam|umm|ahem|unm)\b/g,"column"],
  [/\bcolumn (?:um|em|him)\b/g,"column"],
  [/\b(?:count|cown?t|town) (?:her|or|er|a|uh|ur|err)\b/g,"counter"],
  [/\b(?:for|four|fore|4|far|from) (?:word|words|ward|wards|wood|world|what|wort|wed|whirred)\b/g,"forward"],
  [/\b(?:back|bach|bac) (?:ward|wards|word|words|wood|what)\b/g,"backward"],
  [/\b(?:a|uh) (?:bout|bow|but)\b/g,"about"],
  [/\b(?:ten|10|tin|tan|ton|then|den|a ten|atten|at ten|tensh|tench|tens|tense|tenn|tent) (?:hut|hot|hat|hood|hunt|huh|hutt|but|shut)\b/g,"tenhut"],
  [/\btenhut\b/g,"tenhut"],
  [/\b(?:fall|falls|fault|foal) (?:in|inn|and|end|en|on)\b/g,"fallin"],
  [/\b(?:in trouble|in troubles|inter vals?|inner vals?|in a vols?|in travel|in tervals?)\b/g,"interval"],
  [/\b(?:closin|closing|closen|clothing|closer)(?= interval)/g,"close"],
  [/\b(?:falling|fallen|fallin|follow in|for lin|fallon)\b/g,"fallin"],
  [/\b(?:per|pa|pur|purr|pare|pear|para) (?:aid|raid|rade|ade|rate|ray)\b/g,"parade"],
  [/\b(?:stand|stan|stands) (?:at|and|add|an|it|a) (?:ease|ees|easy|e's|these|is|e|ez|ys|eat)\b/g,"standatease"],
  [/\b(?:stand|stan|stands) (?:at|and) these\b/g,"standatease"],
  [/\b(?:at|add|and|it|ad) (?:ease|ees|easy|e's|these|ez|ys)\b/g,"atease"],
  [/\bextended?\b/g,"extend"], [/\bx (?:10|ten|tend)\b/g,"extend"], [/\bex tend\b/g,"extend"],
  [/\b(?:re|ree|real|rare|rear) (?:mark|march|marsh|much|match)\b/g,"rear march"],
  [/\bremark\b|\bremarch\b|\brymarch\b|\brearmarch\b/g,"rear march"],
];
function normalizeSpeech(text){
  let t=(" "+String(text||"").toLowerCase()+" ")
    .replace(/[‘’`]/g,"'").replace(/[^a-z0-9' ]+/g," ")
    .replace(/(\d)(?=[a-z])/g,"$1 ").replace(/\b4th\b/g,"fourth")
    .replace(/'s\b/g,"").replace(/'/g,"")
    .replace(/([a-z])\1{2,}/g,"$1").replace(/\s+/g," ").trim();
  for(const [re,rep] of REWRITES) t=t.replace(re,rep);
  return t.replace(/\s+/g," ").trim();
}
/** Map one token to its canonical keyword(s) */
function canonOf(tok){
  if(UNIT_SET.has(tok)) return ["unit"];
  if(KW_LOOKUP[tok]) return KW_LOOKUP[tok];
  if(tok.length>=5){ for(const k of FUZZY_KW) if(lev(tok,k)<=1) return [k==="platoon"?"unit":k]; }
  if(tok.length>=5 && lev(tok,"column")<=2 && tok[0]==="c") return ["column"];
  return null;
}
function execClassesOf(tok){
  if(EXEC_LOOKUP[tok]) return EXEC_LOOKUP[tok];
  if(tok.length>=4 && tok.length<=6 && lev(tok,"march")<=1) return ["MARCH"];
  if(tok.length>=8 && lev(tok,"attention")<=2) return ["ATTN"];
  return null;
}
/* Preparatory-command patterns on the canonical keyword string (units and filler removed).
   whole:true means the prep must be exactly that word (short, easily-misheard words). */
const PREP = {
  MARCH:[
    ["counter",  /(?:^| )counter(?: column)?$/],
    ["halfstep", /(?:^| )half step$/],
    ["colHR",    /(?:^| )(?:column )?(?:half right|right half)(?: column)?$/],
    ["colHL",    /(?:^| )(?:column )?(?:half left|left half)(?: column)?$/],
    ["colR",     /(?:^| )(?:column right|right column)$/],
    ["colL",     /(?:^| )(?:column left|left column)$/],
    ["rflank",   /(?:^| )(?:right flank|flank right)$/],
    ["lflank",   /(?:^| )(?:left flank|flank left)$/],
    ["rstep",    /(?:^| )right step$/],
    ["lstep",    /(?:^| )left step$/],
    ["back",     /(?:^| )backward$/],
    ["mark",     /(?:^| )mark time$/],
    ["change",   /(?:^| )change step$/],
    ["double",   /(?:^| )double time$/],
    ["quick",    /(?:^| )quick time$/],
    ["openranks",/(?:^| )open ranks$/],
    ["closeranks",/(?:^| )close ranks$/],
    ["closeint", /(?:^| )close interval$/],
    ["normint",  /(?:^| )normal interval$/],
    ["extend",   /(?:^| )extend$/],
    ["close",    /^close$/],
    ["rear",     /(?:^| )rear$/],
    ["rear",     /^rearWeak$/],
    ["forward",  /(?:^| )forward$/],
  ],
  FACE:[["rface",/^right$/],["lface",/^left$/],["aface",/(?:^| )about$/]],
  REST:[["parade",/(?:^| )parade$/]],
  EASE:[["standease",/(?:^| )stand(?: at)?$/]],
  DRESS:[["dress",/(?:^| )right$/]],
  RIGHT:[["eyes",/(?:^| )eyes$/]],
  FRONT:[["front",/(?:^| )ready$/]],
};
/** Turn tokens into canonical keywords. Returns {canon:[...], unit:bool, junkAtEnd:bool}. */
function canonPrep(tokens){
  const out=[]; let unit=false;
  for(let i=0;i<tokens.length;i++){
    const w=tokens[i];
    // "march time" / "marsh time" before an execution word is Mark time
    if(i+1<tokens.length && execClassesOf(w)?.includes("MARCH") && canonOf(tokens[i+1])?.includes("time")){ out.push("mark"); continue; }
    const c=canonOf(w);
    if(c){
      if(c[0]==="unit"){ unit=true; continue; }
      out.push(c.length>1 ? c : c[0]); continue;
    }
    if(FILLER.has(w)) continue;
    out.push("_");   // unknown word
  }
  return {canon:out, unit};
}
/** All ways to read ambiguous tokens (e.g. "and" = at / in), capped */
function expand(canon){
  let res=[[]];
  for(const c of canon){ const opts=Array.isArray(c)?c:[c]; const nx=[]; for(const r of res) for(const o of opts) nx.push(r.concat(o)); res=nx.slice(0,32); }
  return res.map(r=>r.join(" "));
}
function matchPrep(cls, tokens){
  const pats=PREP[cls]; if(!pats) return null;
  const {canon}=canonPrep(tokens);
  for(const s of expand(canon)){
    for(const [id,re] of pats) if(re.test(s)) return CMD[id];
  }
  return null;
}

/** Parse a transcript into {cmd, prep} or null, using the LAST execution word heard. */
/* "(Number) steps to the right/left, MARCH". Parsed on the raw words (before drill-word rewrites) so the
   count can't be lost or reinterpreted, and so "5 steps forward, march" can't sneak through as Forward, MARCH.
   Returns a copy of CMD.nsteps with n (null = no count heard) and dir ("R"/"L", or "bad" for any other way).
   Range/direction checks happen in canExecute, so a wrong count is the DS "!" rather than silence. */
const NSTEP_NUM={zero:0,oh:0,"0":0,none:0,one:1,won:1,wan:1,"1":1,two:2,to:2,too:2,tu:2,"2":2,three:3,tree:3,free:3,thre:3,"3":3,
  four:4,for:4,fore:4,fo:4,foe:4,"4":4,five:5,"5":5,six:6,sicks:6,"6":6,seven:7,"7":7,eight:8,ate:8,"8":8,nine:9,"9":9,ten:10,"10":10,
  eleven:11,twelve:12,fifteen:15,twenty:20,thirty:30,fifty:50,hundred:100,thousand:1000,million:1e6};
const NSTEP_DIR={right:"R",write:"R",rite:"R",ride:"R",wright:"R",rye:"R",ri:"R",rights:"R",
  left:"L",lef:"L",lift:"L",laugh:"L",lefts:"L",leff:"L",
  forward:"bad",forwards:"bad",front:"bad",ahead:"bad",rear:"bad",back:"bad",backward:"bad",backwards:"bad",up:"bad",down:"bad",around:"bad",center:"bad",middle:"bad",side:"bad"};
function parseNSteps(text, needExec){
  let tok=String(text||"").toLowerCase().replace(/[‘’`']/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\b(\d+)(?=[a-z])/g,"$1 ").split(/\s+/).filter(Boolean);
  if(tok.length && UNIT_SET.has(tok[0])) tok=tok.slice(1);
  if(needExec){ const last=tok[tok.length-1]; if(!last || !(execClassesOf(last)||[]).includes("MARCH")) return null; tok=tok.slice(0,-1); }
  let i=0, n=null;
  if(tok[i]!==undefined && /^\d+$/.test(tok[i])){ n=+tok[i]; i++; }
  else if(tok[i]!==undefined && tok[i] in NSTEP_NUM && /^(?:steps?|stepped|stops?|steppes|stepps|staps?)$/.test(tok[i+1]||"")){ n=NSTEP_NUM[tok[i]]; i++; }
  else if(tok[i]==="a"||tok[i]==="an"||tok[i]==="some"||tok[i]==="few"||tok[i]==="couple"){ i++; }      // no count given
  if(!/^(?:steps?|stepped|stops?|steppes|stepps|staps?)$/.test(tok[i]||"")) return null;
  i++;
  while(["to","too","two","the","da","tha","tuh","de"].includes(tok[i])) i++;
  const dir=NSTEP_DIR[tok[i]]; if(!dir) return null; i++;
  if(i!==tok.length) return null;                                    // anything else after it: chatter
  return Object.assign(Object.create(CMD.nsteps), {n, dir});
}
function parseExact(text){
  const t=normalizeSpeech(text);
  const tok=t.split(" ").filter(Boolean);
  if(!tok.length) return null;
  // FALL OUT: a one-part call, only when that is ALL that was said ("my phone fell out" is chatter)
  { const r=String(text).toLowerCase().replace(/[^a-z ]/g,"").replace(/\s+/g," ").trim().replace(/^(?:platoon|squad|unit|flight) /,"");
    if(/^(?:(?:fall|fal|fawl|fol|foll|fallen) ?(?:out|owt|aut|ought|at|outs)|fallout|fallouts|(?:ball|call|paul|hall) out)$/.test(r)) return {cmd:CMD.fallout, prep:""}; }
  // "Fall in" heard as a rhyme ("call in", "ball in", "paul in"...): only when that is ALL that was said
  if(/^(?:(?:platoon|squad|unit) )?(?:call|ball|paul|hall|fa|fah|fol|fawl|fallen|full|foll?) (?:in|inn|en|and)$/.test(t+"") || /^(?:(?:platoon|squad|unit) )?(?:call|ball|paul|hall|fa|fah|fol|fawl|full) (?:in|inn|en|and)$/.test(String(text).toLowerCase().replace(/[^a-z ]/g,"").replace(/\s+/g," ").trim())) return {cmd:CMD.fallin, prep:"fall"};
  // COVER / RECOVER: one-part calls, accepted only when that is ALL that was said (so "take cover" is chatter)
  const raw=String(text).toLowerCase().replace(/[^a-z ]/g,"").replace(/\s+/g," ").trim().replace(/^(?:platoon|squad|unit|flight|and) /,"");
  if(/^(?:re|ree|ri|we|wee|reed|three) ?(?:cover|cuvver|covah|cova|cuva|kover|covers|covered|cuver)$|^(?:recovered|recovah|recuvver|recova|recovery|recuva|recover)$/.test(raw)) return {cmd:CMD.recover, prep:""};
  if(/^(?:cover|cuvver|covah|cova|cuva|kover|covers|cuver|lover|brother|cover up|covah up|cupboard)$/.test(raw)) return {cmd:CMD.cover, prep:""};
  const last=tok[tok.length-1], tail=tok.slice(-4);
  // one-part and special forms
  if(last==="atease" && !tail.includes("standatease")) return {cmd:CMD.atease, prep:""};
  if(last==="standatease") return {cmd:CMD.standease, prep:"stand at"};
  if(last==="tenhut") return {cmd:CMD.attn, prep:tok.slice(-5,-1).join(" ")};
  if(last==="fallin" || (tok.length>=2 && last==="in" && canonOf(tok[tok.length-2])?.includes("fall"))) return {cmd:CMD.fallin, prep:"fall"};
  // command of execution: the last recognised one, allowing up to two trailing noise words
  for(let i=tok.length-1;i>=Math.max(0,tok.length-3);i--){
    const classes=execClassesOf(tok[i]);
    if(!classes){ if(canonOf(tok[i])) break; continue; }      // a drill word after it: this isn't the end
    const prepTok=tok.slice(Math.max(0,i-6), i), prep=prepTok.join(" ");
    for(const cls of classes){
      if(cls==="HALT"||cls==="ATTN"){
        const {canon,unit}=canonPrep(prepTok);
        const bare = canon.filter(c=>c!=="_").length===0;
        const strict = cls==="HALT" ? ["halt","holt","hault","halts","hlt","hallt"].includes(tok[i]) : ["attention","tenshun","attenshun"].includes(tok[i]);
        if(unit || ((settings.sens==="recruit"||settings.sens==="none") && bare && prepTok.length===0 && strict)) return {cmd:CMD[cls==="HALT"?"halt":"attn"], prep};
        continue;
      }
      const c=matchPrep(cls, prepTok);
      if(c) return {cmd:c, prep};
    }
    // "Column left mark": "mark" heard as the execution word but it's the start of "mark time"? no: fall through
  }
  return null;
}
/** A preparatory command with no execution word yet (e.g. Android ended the session at the pause). */
function parsePrepOnly(text){
  const ns=parseNSteps(text,false); if(ns) return ns;
  const tok=normalizeSpeech(text).split(" ").filter(Boolean);
  if(!tok.length) return null;
  // "Platoon…" alone: the prep for HALT while marching, ATTENTION at the halt
  if(tok.length<=2 && tok.every(t=>UNIT_SET.has(t)||FILLER.has(t)) && tok.some(t=>UNIT_SET.has(t)))
    return (typeof marching==="function" && marching()) ? CMD.halt : CMD.attn;
  for(const cls of ["MARCH","FACE","REST","DRESS","FRONT","RIGHT"]){
    const c=matchPrep(cls, tok.slice(-6));
    if(c && !(cls==="DRESS"||cls==="FACE") ) return c;   // "right"/"left" alone is too ambiguous to wait on
  }
  return null;
}

/* ======================================================================
   SETTINGS & PERSISTENCE
   Difficulty levels (saved in localStorage "formation.sens"):
     none    = Commands only: no inflection check (warm-up)
     recruit = ANY one emphasis cue on the execution word (default)
     soldier = any TWO cues
     ds      = Drill Sergeant: every strict rule
   The three cues are: louder than the prep, a pitch change, a pause before it.
====================================================================== */
const SENS = {
  none:    {label:"Commands only", cues:0, loud:0,   pitch:0,   gap:0,   foot:"ignore", needAttn:false},
  recruit: {label:"Recruit",       cues:1, loud:2.5, pitch:1.0, gap:80,  foot:"ignore", needAttn:false},
  soldier: {label:"Soldier",       cues:2, loud:3.0, pitch:1.5, gap:120, foot:"warn",   needAttn:true},
  ds:      {label:"Drill Sergeant",cues:3, loud:6.0, pitch:3.0, gap:80,  foot:"reject", needAttn:true,
            strict:{maxDur:600, attack:150, prepRise:0.5}},
};
function loadSens(){
  const v=localStorage.getItem("formation.sens");
  if(v && SENS[v] && localStorage.getItem("formation.sensVer")==="2") return v;
  // first run, or a setting saved by the old easy/standard/ds version: start on Recruit
  localStorage.setItem("formation.sens","recruit"); localStorage.setItem("formation.sensVer","2");
  return "recruit";
}
function saveSens(v){ if(SENS[v]){ localStorage.setItem("formation.sens",v); localStorage.setItem("formation.sensVer","2"); } }
const settings = { sens:loadSens(), unit:"Platoon", tick:true, clarity:(["lenient","standard","strict","exact"].includes(localStorage.getItem("formation.clarity"))?localStorage.getItem("formation.clarity"):"lenient") };
let hiScore = +localStorage.getItem("formation.hi") || 0;

/* ======================================================================
   AUDIO: step ticks + mic analysis (pitch and loudness)
====================================================================== */
let actx=null, analyser=null, micStream=null, micOK=false, audioBuf=null;
const frames=[];             // ring of {t, db, rel, hz}, ~25 ms apart, last 8 s (rel = dB above noise floor)
let noiseFloor=-60, lastLoudT=0;
function ensureAudio(){
  if(!actx){ const AC=window.AudioContext||window.webkitAudioContext; if(AC) actx=new AC(); }
  // iOS Safari: "suspended" until a tap, "interrupted" after a call/Siri/backgrounding; resume() must run in a gesture
  if(actx && actx.state!=="running" && actx.state!=="closed"){ try{ const r=actx.resume(); if(r&&r.catch) r.catch(()=>{}); }catch(_){} }
}
function tick(foot){
  if(!actx||!settings.tick) return;
  const t=actx.currentTime, o=actx.createOscillator(), g=actx.createGain();
  o.type="triangle"; o.frequency.setValueAtTime(foot==="L"?140:190,t); o.frequency.exponentialRampToValueAtTime(60,t+.08);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(foot==="L"?.35:.2,t+.005); g.gain.exponentialRampToValueAtTime(.0001,t+.1);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t+.12);
}
function chime(ok){
  if(!actx) return; const t=actx.currentTime, o=actx.createOscillator(), g=actx.createGain();
  o.type="sine"; o.frequency.setValueAtTime(ok?880:220,t); if(ok) o.frequency.setValueAtTime(1320,t+.07);
  g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.0001,t+.18); o.connect(g).connect(actx.destination); o.start(t); o.stop(t+.2);
}
async function startMic(){
  // Raw audio is preferred (processing would flatten the emphasis we measure), but fall back
  // to whatever the browser gives us rather than failing.
  // Safari 17+: keep game sounds on the loudspeaker while the mic is open
  try{ if(navigator.audioSession && navigator.audioSession.type!=="play-and-record") navigator.audioSession.type="play-and-record"; }catch(_){}
  const tries=[
    {audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1}},
    {audio:{echoCancellation:{ideal:false}, noiseSuppression:{ideal:false}, autoGainControl:{ideal:false}}},
    {audio:true},
  ];
  let lastErr=null;
  for(const c of tries){
    try{ micStream=await navigator.mediaDevices.getUserMedia(c); break; }
    catch(e){ lastErr=e; if(e.name==="NotAllowedError"||e.name==="SecurityError") break; }
  }
  if(!micStream){
    micOK=false; const n=$("noMic");
    n.textContent="Microphone unavailable ("+(lastErr&&lastErr.name)+"). Commands still work, but inflection can't be measured. Allow mic access to use the inflection check.";
    n.classList.add("on"); return false;
  }
  ensureAudio();
  // iOS can end or mute the meter's track (another app, Siri, speech recognition taking the mic): drop
  // the meter quietly; commands then go through without the inflection check, voice burst falls back to words
  micStream.getAudioTracks().forEach(t=>{ t.addEventListener("ended",()=>{ if(micStream && micStream.getAudioTracks().includes(t)){ stopMic(); meterOffReason="Voice meter stopped by the phone"; } }); });
  const src=actx.createMediaStreamSource(micStream);
  analyser=actx.createAnalyser(); analyser.fftSize=2048; analyser.smoothingTimeConstant=0;
  src.connect(analyser); audioBuf=new Float32Array(analyser.fftSize); micOK=true;
  clearInterval(frameTimer); frameTimer=setInterval(analyseFrame, 25);
  return true;
}
let frameTimer=null;
/** Release the mic stream (used when the voice meter would starve speech recognition, e.g. Android Chrome). */
function stopMic(){
  clearInterval(frameTimer); frameTimer=null; micOK=false;
  if(micStream){ micStream.getTracks().forEach(t=>t.stop()); micStream=null; }
  analyser=null;
}
/** One analysis frame: RMS level (dBFS), level above the noise floor, and pitch (Hz) */
function analyseFrame(){
  analyser.getFloatTimeDomainData(audioBuf);
  let sum=0; for(let i=0;i<audioBuf.length;i++) sum+=audioBuf[i]*audioBuf[i];
  const rms=Math.sqrt(sum/audioBuf.length), db=20*Math.log10(rms+1e-9);
  const t=now()-(analyser.fftSize/actx.sampleRate)*500; // centre of the analysis window
  const hz = db>noiseFloor+6 ? detectPitch(audioBuf, actx.sampleRate) : 0;
  pushFrame(t, db, hz);
  // adaptive noise floor: falls fast, rises slowly
  noiseFloor = db<noiseFloor ? lerp(noiseFloor,db,.3) : lerp(noiseFloor,db,.004);
  noiseFloor = clamp(noiseFloor,-90,-35);
}
function pushFrame(t, db, hz){
  frames.push({t, db, rel:db-noiseFloor, hz});
  while(frames.length && frames[0].t<t-8000) frames.shift();
  // loud = the player's voice; the cadence coming out of the speaker doesn't count
  if(db-noiseFloor>VOICE_REL && !(typeof cadBleed==="function" && cadBleed(db))){ lastLoudT=t; if(typeof cadVoiceFrame==="function") cadVoiceFrame(t); }
  if(typeof burstCheck==="function") burstCheck(frames[frames.length-1]);
}
const VOICE_REL = 9;                                     // voiced = 9 dB above the noise floor
const voiceThresh = ()=> noiseFloor+VOICE_REL;           // (absolute dB, for the meter line)
/** Normalised autocorrelation on a 2x-decimated buffer, 70–450 Hz. Returns 0 if unvoiced. */
function detectPitch(buf, sr){
  const N=buf.length>>1, x=new Float32Array(N);
  for(let i=0;i<N;i++) x[i]=(buf[2*i]+buf[2*i+1])*.5;
  const fs=sr/2, minLag=Math.floor(fs/450), maxLag=Math.min(Math.floor(fs/70), N>>1), M=N-maxLag;
  let e0=0; for(let i=0;i<M;i++) e0+=x[i]*x[i];
  let best=0, bestLag=0, prev=1, rising=false; const r=[];
  for(let lag=minLag;lag<=maxLag;lag++){
    let c=0, e1=0; for(let i=0;i<M;i++){ c+=x[i]*x[i+lag]; e1+=x[i+lag]*x[i+lag]; }
    const v=c/Math.sqrt(e0*e1+1e-12); r[lag]=v;
    if(v>prev) rising=true;                  // skip the zero-lag lobe
    if(rising && v>best){ best=v; bestLag=lag; }
    prev=v;
  }
  if(best<0.5||!bestLag) return 0;
  const a=r[bestLag-1]??best, b=best, c=r[bestLag+1]??best, den=(a-2*b+c)||1, p=(a-c)/(2*den);
  return fs/(bestLag+clamp(p,-.5,.5));      // parabolic interpolation
}
const semis = (a,b)=> 12*Math.log2(a/b);
const median = arr => { if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[s.length>>1]; };
/** Fold an interval into ±6 semitones when it looks like an octave error (pitch trackers often halve/double). */
const foldOctave = st => Math.abs(st)>8 ? st-12*Math.round(st/12) : st;

/** Clean a run of frames' pitch: 5-point median filter, then octave-correct each value
    against the run's median (snap 2x / 0.5x jumps back). */
function cleanPitch(fr){
  const raw=fr.map(f=>f.hz), out=[];
  for(let i=0;i<raw.length;i++){
    if(!raw[i]){ out.push(0); continue; }
    const w=raw.slice(Math.max(0,i-2), i+3).filter(Boolean);
    out.push(median(w));
  }
  const ref=median(out.filter(Boolean));
  return out.map(h=>{ if(!h||!ref) return h; let st=semis(h,ref); while(st>8){ h/=2; st-=12; } while(st<-8){ h*=2; st+=12; } return h; });
}

/** Split recent audio into voiced bursts (relative to the noise floor): [{t0,t1,peak,peakT,fr}] */
function segmentsBetween(tA,tB){
  const segs=[]; let cur=null, quiet=0;
  for(const f of frames){
    if(f.t<tA||f.t>tB) continue;
    if(f.rel>VOICE_REL){ if(!cur) cur={t0:f.t,t1:f.t,peak:f.rel,peakT:f.t,fr:[]}; cur.t1=f.t; cur.fr.push(f); if(f.rel>cur.peak){cur.peak=f.rel;cur.peakT=f.t;} quiet=0; }
    else if(cur){ quiet+=25; if(quiet>=75){ segs.push(cur); cur=null; quiet=0; } }   // ≥75 ms of quiet ends a burst
  }
  if(cur) segs.push(cur);
  return segs.filter(s=>s.t1-s.t0>=40);
}
/** If speech ran together into one burst, split off the final ~40% (max 450 ms) as the execution word. */
function splitRunTogether(seg){
  const dur=seg.t1-seg.t0, cut=seg.t1-Math.min(450, dur*.4);
  const mk=fr=>{ const p=fr.reduce((m,f)=>f.rel>m.rel?f:m, fr[0]); return {t0:fr[0].t,t1:fr[fr.length-1].t,peak:p.rel,peakT:p.t,fr}; };
  const a=seg.fr.filter(f=>f.t<cut), b=seg.fr.filter(f=>f.t>=cut);
  return (a.length>=3 && b.length>=3) ? [mk(a), mk(b)] : null;
}
const energyMean = fr => 10*Math.log10(fr.reduce((a,f)=>a+Math.pow(10,f.rel/10),0)/Math.max(1,fr.length));

/** Measure how the command of execution was emphasised. Returns metrics or a reason it couldn't. */
function measureEmphasis(heardAt){
  if(!micOK) return {unavailable: meterOffReason || "no mic level", meterOff:true};
  const from=Math.max(heardAt-6000, ttsQuietSince), to=Math.min(now(), heardAt+1000);
  let segs=segmentsBetween(from, to);
  if(!segs.length){
    // Some Android builds silence the mic stream while speech recognition is running.
    if(!frames.some(f=>f.t>from && f.rel>3)) return {unavailable:"mic level blocked during recognition"};
    return {unavailable:"voice not separated from background noise"};
  }
  // Execution word = the LOUDEST burst among those ending in the final ~1.2 s of speech (ties → the later one).
  const lastEnd=segs[segs.length-1].t1;
  let exIdx=segs.length-1;
  for(let i=segs.length-1;i>=0;i--){ if(segs[i].t1<lastEnd-1200) break; if(segs[i].peak>segs[exIdx].peak+1) exIdx=i; }
  let ex=segs[exIdx], prepSegs=segs.slice(0,exIdx).filter(s=>s.t0>ex.t0-4000), merged=false;
  if(!prepSegs.length){
    const sp=splitRunTogether(ex);
    if(!sp) return {unavailable:"couldn't separate the prep from the execution", ex};
    prepSegs=[sp[0]]; ex=sp[1]; merged=true;
  }
  const prepFr=prepSegs.flatMap(s=>s.fr);
  const loud = ex.peak - energyMean(prepFr);                 // dB, both relative to the noise floor
  const gap  = merged ? 0 : ex.t0 - prepSegs[prepSegs.length-1].t1;
  const pP=cleanPitch(prepFr).filter(Boolean), eP=cleanPitch(ex.fr).filter(Boolean);
  const third=Math.max(1,Math.floor(pP.length/3));
  const prepStart=median(pP.slice(0,third)), prepEnd=median(pP.slice(-third)), execHz=median(eP);
  const pitch = (prepEnd&&execHz) ? foldOctave(semis(execHz,prepEnd)) : null;   // null = no pitch measured
  const prepRise = (prepStart&&prepEnd) ? foldOctave(semis(prepEnd,prepStart)) : 0;
  return {ex, prepSegs, merged, loud, gap, pitch, prepRise, dur:ex.t1-ex.t0, attack:ex.peakT-ex.t0};
}

/** Judge inflection for the current difficulty. Returns {ok, reason, hint, checks:[...], ...}.
    checks = [{name, got, need, pass}] so the UI can show measured vs needed values. */
function analyseInflection(cmd, heardAt){
  const lvl=settings.sens, S=SENS[lvl];
  if(lvl==="none") return {ok:true, detail:"Commands only: no inflection check"};
  const m=measureEmphasis(heardAt);
  if(m.unavailable){
    // Only reject when the meter is running but couldn't measure. If the meter is off (e.g. Android can't
    // share the mic with speech recognition), commands are accepted on every level.
    if(lvl==="ds" && !m.meterOff) return {ok:false, reason:"Couldn't hear inflection", hint:"Speak up and pause briefly before the last word ("+m.unavailable+")", ex:m.ex, checks:[]};
    return {ok:true, warn:"Inflection not measured ("+m.unavailable+"), accepted", ex:m.ex};
  }
  const ck=[
    {key:"loud",  name:"Louder", got:m.loud, need:S.loud, unit:"dB", pass:m.loud>=S.loud},
    {key:"pitch", name:"Pitch",  got:m.pitch, need:S.pitch, unit:"st", pass:m.pitch!==null && Math.abs(m.pitch)>=S.pitch},
    {key:"gap",   name:"Pause",  got:m.gap, need:S.gap, unit:"ms", pass:m.gap>=S.gap},
  ];
  if(lvl==="ds"){
    const st=S.strict;
    ck.push({key:"dur", name:"Short", got:m.dur, need:st.maxDur, unit:"ms", max:true, pass:m.dur<=st.maxDur});
    ck.push({key:"attack", name:"Sharp", got:m.attack, need:st.attack, unit:"ms", max:true, pass:m.attack<=st.attack});
    ck.push({key:"rise", name:"Prep rise", got:m.prepRise, need:st.prepRise, unit:"st", pass:m.prepRise>=st.prepRise});
  }
  const passed=ck.slice(0,3).filter(c=>c.pass).length;
  const ok = lvl==="ds" ? ck.every(c=>c.pass) : passed>=S.cues;
  const base={ok, ex:m.ex, prepSegs:m.prepSegs, checks:ck, metrics:m, need:S.cues};
  const summary=ck.map(c=>`${c.pass?"✓":"✗"} ${c.name} ${fmtVal(c)}`).join(" · ");
  if(ok) return Object.assign(base,{reason:"ACCEPTED", detail:summary});
  // Coaching: suggest the cue that's closest to passing first
  const failing=ck.filter(c=>!c.pass).sort((a,b)=>closeness(b)-closeness(a));
  const want = lvl==="ds" ? "all checks" : (S.cues===1? "one cue" : S.cues+" cues")+` (got ${passed})`;
  return Object.assign(base,{reason: passed===0 && lvl!=="ds" ? "No emphasis" : "More emphasis needed",
    hint: failing.slice(0, lvl==="ds"?2:Math.max(1,S.cues-passed)).map(c=>HINTS[c.key]).join(" "),
    detail:`Needs ${want}: ${summary}`});
}
const HINTS = {
  loud:"Punch the last word louder.",
  pitch:"Change pitch on the last word: let the prep rise, then drop (or snap up) on the execution.",
  gap:"Pause briefly before the last word.",
  dur:"Keep the last word short.",
  attack:"Hit the last word sharply, all at once.",
  rise:"Raise your pitch through the preparatory command.",
};
function fmtVal(c){
  if(c.got===null||c.got===undefined) return `n/a (need ${c.max?"≤":"≥"}${c.need}${c.unit})`;
  const v = c.unit==="ms" ? Math.round(c.got) : (c.key==="pitch"? Math.abs(c.got):c.got).toFixed(1);
  return `${c.unit!=="ms"&&c.key!=="pitch"&&c.got>=0?"+":""}${v}${c.unit} (need ${c.max?"≤":"≥"}${c.need})`;
}
function closeness(c){ if(c.got===null) return -1; const g=c.key==="pitch"?Math.abs(c.got):c.got; return c.max? c.need/Math.max(g,1) : g/Math.max(c.need,0.01); }
