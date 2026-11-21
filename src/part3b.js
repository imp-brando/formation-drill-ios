
/* ======================================================================
   SOUND-ALIKE MATCHER (fallback when the exact parser finds nothing)
   Drill sergeants clip and slur ("colm lef HARCH", "fowahd-harch", "haaalt").
   1. Every heard token becomes a loose phonetic key (vowels dropped, doubled
      and stretched letters merged, silent letters removed, ch/sh = X).
   2. The keys of the whole utterance are joined, so run-together words
      ("fowardharch") and split words ("call him") line up the same way.
   3. Each command is a sequence of slots (direction / movement / execution),
      each slot with drill-style variants. A weighted edit distance aligns the
      END of the utterance to each command (start on a word boundary).
      Similar sounds (t/d, m/n, k/g, p/b, f/v, s/x, l/r) are cheap; a dropped
      ending or an extra "h" is cheap; anything else costs a full point.
   4. Every slot must sound like its word and the whole command must score
      above the Word clarity threshold, and clearly beat the next-best
      different command. Talk that doesn't fit a whole prep + execution is
      ignored.
====================================================================== */
const VOW="aeiouy";
const normT = t => String(t||"").toLowerCase().replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ").trim();
function phonKey(w){
  w=String(w).toLowerCase().replace(/[^a-z]/g,""); if(!w) return "";
  w=w.replace(/(.)\1+/g,"$1")
    .replace(/^(kn|gn|pn)/,"n").replace(/^wr/,"r").replace(/^wh/,"w").replace(/^x/,"s")
    .replace(/mn$/,"m").replace(/mb$/,"m").replace(/alf/g,"af").replace(/(au|ou)gh/g,"$1f")
    .replace(/igh/g,"i").replace(/gh/g,"").replace(/ph/g,"f").replace(/tch/g,"ch").replace(/ck/g,"k")
    .replace(/sch/g,"sk").replace(/ch|sh/g,"X").replace(/th/g,"0").replace(/dg/g,"j").replace(/tion/g,"Xn")
    .replace(/c(?=[eiy])/g,"s").replace(/[cq]/g,"k").replace(/x/g,"ks").replace(/z/g,"s");
  let out=VOW.includes(w[0])?"A":"";
  for(let i=0;i<w.length;i++){
    const ch=w[i];
    if(VOW.includes(ch)) continue;
    if(ch==="h" && i>0) continue;                                  // h only counts at the start
    if(ch==="w" && !VOW.includes(w[i+1]||"")) continue;            // "forwahd" ~ "foward"
    if(ch==="r" && i>0 && VOW.includes(w[i-1]) && !VOW.includes(w[i+1]||"") && i<w.length-1 && w[i+1]!=="r") { out+="r"; continue; }   // non-rhotic r: optional (cheap)
    out+= ch==="X"||ch==="0" ? ch : ch.toUpperCase();
  }
  return out.replace(/(.)\1+/g,"$1");
}
const SIMILAR=[["P","B",.35],["T","D",.3],["K","G",.35],["F","V",.35],["S","X",.4],["S","J",.5],["X","J",.4],["M","N",.35],["L","R",.6],["F","0",.4],["T","0",.5],["W","V",.6],["K","T",.75],["P","K",.75],["P","T",.75],["L","r",.5],["R","r",.1]];
const SUBC={}; for(const [a,b,c] of SIMILAR){ SUBC[a+b]=c; SUBC[b+a]=c; }
const delC=c=> c==="A"||c==="H"||c==="r" ? .3 : .7;               // template sound not heard (dropped)
const insC=c=> c==="A"||c==="H"||c==="r" ? .3 : .85;              // extra heard sound
const subC=(a,b)=> a===b ? 0 : (SUBC[a+b] ?? ((a==="r"||b==="r") ? .8 : 1));

const V=(...ws)=>ws;
const SL={
  COL:V("column","colm","colum","collum","cum","comm","kolm","colin"),
  LEFT:V("left","lef","lefft","lehf","laf","lift"),
  RIGHT:V("right","ri","rah","rye","rai","rat","write"),
  HALF:V("half","haf","hah","have"),
  COUNTER:V("counter","counta","cowner","cownter"),
  FLANK:V("flank","flan","flang","flan k"),
  REAR:V("rear","reah","rea","rare"),
  FORWARD:V("forward","foward","fowahd","forwah","fowah","for"),
  MARK:V("mark","mahk","mar"), TIME:V("time","tie","tam","tah"),
  STEP:V("step","stef","stuh","stehp"), CHANGE:V("change","chain","chay"),
  DOUBLE:V("double","dub","dubba"), QUICK:V("quick","quih","kwik"),
  BACKWARD:V("backward","backwa","backwah"), OPEN:V("open","ope"), CLOSE:V("close","clo","cloh"),
  RANKS:V("ranks","rank","rahks"), INTERVAL:V("interval","intervals","intaval","innerval","intuhval","introval"), NORMAL:V("normal","nomal","normo"), EXTEND:V("extend","extin"),
  UNIT:V("platoon","toon","plato","platun","squad","squa","flight","fligh","flai"),
  ABOUT:V("about","bout","bow","abow"), PARADE:V("parade","prade","parah","pahrade"),
  STAND:V("stand","stan"), AT:V("at","and","add"), DRESS:V("dress","dres"), EYES:V("eyes","eye","ah"),
  READY:V("ready","reh","rea","reddy"), FALL:V("fall","fa","fah"),
  // command of execution, including drill-sergeant forms
  xMARCH:V("march","harch","arch","mar","much","mars","marsh","match","harsh","ma","hut","hup","ho","hah","hoh","huh","hoo","haa","hoch","hash","mosh"),
  xHALT:V("halt","hault","holt","hal","hall","hold","hlt","hah","ho","hut"),
  xATTN:V("attention","tenshun","tenshut","tenhut","shun","hut","hun"),
  xFACE:V("face","fay","fah","hace","hay","face"), xREST:V("rest","res","hest"),
  xEASE:V("ease","eas","ees","eeze"), xDRESS:V("dress","dres","hess","jess"),
  xRIGHT:V("right","ri","rah","hight","hai"), xFRONT:V("front","fron","hunt","hron","frun"), xIN:V("in","en","hin","inn"),
};
const SLK={}; for(const [k,arr] of Object.entries(SL)) SLK[k]=[...new Set(arr.map(w=>phonKey(w.replace(/ /g,""))))].filter(Boolean);
// [command id, slots...]; the last slot is the command of execution
const TEMPLATES=[
  ["colL","COL","LEFT","xMARCH"],["colL","LEFT","COL","xMARCH"],["colR","COL","RIGHT","xMARCH"],["colR","RIGHT","COL","xMARCH"],
  ["colHL","COL","HALF","LEFT","xMARCH"],["colHL","HALF","LEFT","xMARCH"],["colHR","COL","HALF","RIGHT","xMARCH"],["colHR","HALF","RIGHT","xMARCH"],
  ["counter","COUNTER","COL","xMARCH"],["counter","COUNTER","xMARCH"],
  ["rflank","RIGHT","FLANK","xMARCH"],["lflank","LEFT","FLANK","xMARCH"],
  ["rear","REAR","xMARCH"],["forward","FORWARD","xMARCH"],["mark","MARK","TIME","xMARCH"],["halfstep","HALF","STEP","xMARCH"],
  ["change","CHANGE","STEP","xMARCH"],["double","DOUBLE","TIME","xMARCH"],["quick","QUICK","TIME","xMARCH"],
  ["rstep","RIGHT","STEP","xMARCH"],["lstep","LEFT","STEP","xMARCH"],["back","BACKWARD","xMARCH"],
  ["openranks","OPEN","RANKS","xMARCH"],["closeranks","CLOSE","RANKS","xMARCH"],["extend","EXTEND","xMARCH"],["close","CLOSE","xMARCH"],
  ["closeint","AT","CLOSE","INTERVAL","xMARCH"],["closeint","CLOSE","INTERVAL","xMARCH"],["normint","AT","NORMAL","INTERVAL","xMARCH"],["normint","NORMAL","INTERVAL","xMARCH"],
  ["halt","UNIT","xHALT"],["attn","UNIT","xATTN"],
  ["rface","RIGHT","xFACE"],["lface","LEFT","xFACE"],["aface","ABOUT","xFACE"],["parade","PARADE","xREST"],
  ["standease","STAND","AT","xEASE"],["dress","DRESS","RIGHT","xDRESS"],["eyes","EYES","xRIGHT"],["front","READY","xFRONT"],["fallin","FALL","xIN"],
].map(([id,...slots])=>({id, names:slots,
   // two-slot commands (one prep word): one-sound variants are too weak to trust
   slots:slots.map(s=> slots.length<3 ? SLK[s].filter(k=>k.length>=2) : SLK[s])}));

const PREP_VOCAB=new Set([...Object.keys(KW_LOOKUP),...Object.entries(SL).filter(([k])=>k[0]!=="x").flatMap(([,v])=>v)].filter(w=>w.length>=3));
/* Word clarity: how far a slot may drift from its word. Lenient is the default. */
const CLARITY={ lenient:{slot:.5, total:.7, margin:.06}, standard:{slot:.5, total:.72, margin:.08}, strict:{slot:.7, total:.86, margin:.1} };
function loadClarity(){ const v=localStorage.getItem("formation.clarity"); return CLARITY[v]? v : "lenient"; }

/* User voice aliases from "Train my voice": {cmdId: ["palm left march", ...]} */
let userAliases={};
try{ userAliases=JSON.parse(localStorage.getItem("formation.aliases")||"{}")||{}; }catch(_){ userAliases={}; }
let aliasTemplates=[];
function rebuildAliasTemplates(){
  aliasTemplates=[];
  for(const [id,list] of Object.entries(userAliases)) for(const ph of list||[]){
    const toks=normT(ph).split(" ").filter(Boolean); if(toks.length<2) continue;
    // learned prep (everything before the last word) + the normal execution word
    const ex=TEMPLATES.find(t=>t.id===id); if(!ex) continue;
    const pk=phonKey(toks.slice(0,-1).join("")); if(!pk) continue;
    aliasTemplates.push({id, slots:[[pk], [...new Set([...ex.slots[ex.slots.length-1], phonKey(toks[toks.length-1])])]], names:["ALIAS",ex.names[ex.names.length-1]], alias:true});
  }
}
function saveAliases(){ localStorage.setItem("formation.aliases", JSON.stringify(userAliases)); rebuildAliasTemplates(); }

/* Align the end of the heard key string to one template. Returns {cost, slots:[{cost,len}]} */
function alignTemplate(H, starts, tpl, lastStart){
  const n=H.length, INF=1e9, B=new Set(starts.concat([n]));
  let vec=new Array(n+1).fill(INF); for(const s of starts) vec[s]=0;
  let hist=new Array(n+1).fill(null).map(()=>[]);
  for(let si=0; si<tpl.slots.length; si++){
    const variants=tpl.slots[si];
    if(lastStart!==undefined && si===tpl.slots.length-1) for(let i=0;i<lastStart;i++) vec[i]=INF;   // execution word comes from the last word heard
    const nv=new Array(n+1).fill(INF), nh=new Array(n+1).fill(null);
    for(const v of variants){
      const m=v.length;
      let prev=vec.slice(), prevO=vec.map((_,i)=>i);
      for(let a=1;a<=m;a++){
        const cur=new Array(n+1).fill(INF), curO=new Array(n+1).fill(-1), vc=v[a-1];
        cur[0]=prev[0]+delC(vc); curO[0]=prevO[0];
        for(let i=1;i<=n;i++){
          let best=prev[i]+delC(vc), o=prevO[i];
          const s=prev[i-1]+subC(vc,H[i-1]); if(s<best){ best=s; o=prevO[i-1]; }
          const ins=cur[i-1]+insC(H[i-1]); if(ins<best){ best=ins; o=curO[i-1]; }
          cur[i]=best; curO[i]=o;
        }
        prev=cur; prevO=curO;
      }
      for(let i=0;i<=n;i++){
        if(prev[i]>=INF || prevO[i]<0) continue;
        const span=i-prevO[i]; if(span<1) continue;                     // every slot must be heard
        const sc=prev[i]-vec[prevO[i]], sim=1-sc/Math.max(2,m);
        if(m===1 && (sc>0 || span!==1)) continue;                       // one-sound variants must match exactly
        // compare by total path cost, tie-break on the slot's similarity
        if(prev[i]<nv[i]-1e-9 || (Math.abs(prev[i]-nv[i])<1e-9 && nh[i] && sim>nh[i][nh[i].length-1].sim)){
          nv[i]=prev[i]; nh[i]=hist[prevO[i]].concat({cost:sc,len:Math.max(2,m),sim,from:prevO[i]});
        }
      }
    }
    // slot boundaries fall between spoken words; the execution word may also be the end of a
    // run-together last word ("fowardharch"): at least 3 sounds of prep before it inside that word
    if(si<tpl.slots.length-1){
      const nextIsExec = si===tpl.slots.length-2;
      for(let i=0;i<=n;i++) if(!B.has(i) && !(nextIsExec && lastStart!==undefined && i>=lastStart+3 && n-i>=2)) nv[i]=INF;
      if(nextIsExec) for(let i=0;i<=n;i++) if(nh[i] && !B.has(i)) nh[i]=nh[i].map(x=>x), nh[i].merged=true;
    }
    vec=nv; hist=nh.map(h=>h||[]);
  }
  return {cost:vec[n], slots:hist[n]};
}
function heardKey(tokens){
  let H="", starts=[0], lastStart=0;
  for(const t of tokens){ const k=phonKey(t); if(!k) continue; lastStart=H.length; H+=k; starts.push(H.length); }
  starts.pop(); return {H, starts, lastStart};
}
const SKIP_TAIL=new Set(["uh","um","ah","er","erm","the","a","okay","ok","now","please"]);
/** Best sound-alike command for one transcript, or null. */
function fuzzyParse(text, opt){
  const clar=CLARITY[(opt&&opt.clarity)||settings.clarity||"lenient"];
  let tok=normT(text).split(" ").filter(Boolean);
  while(tok.length && SKIP_TAIL.has(tok[tok.length-1])) tok.pop();
  tok=tok.slice(-7); if(!tok.length) return null;
  tok=tok.filter(t=>!FILLER.has(t) || t==="and"); if(!tok.length) return null;          // filler words never fill a slot
  const variants=[tok];
  const rw=normalizeSpeech(tok.join(" ")).split(" ").filter(Boolean); if(rw.join(" ")!==tok.join(" ")) variants.push(rw);
  // run-together prep words ("colmleft", "halfstep"): split a word whose start is a drill word
  for(let i=0;i<tok.length;i++){
    const w=tok[i]; if(w.length<6) continue;
    for(let c=w.length-3;c>=3;c--) if(PREP_VOCAB.has(w.slice(0,c))){ variants.push(tok.slice(0,i).concat([w.slice(0,c),w.slice(c)],tok.slice(i+1))); break; }
  }
  const results=[];
  for(const tk of variants){
    // try the last 1..7 words as the command (start on a word boundary)
    const {H, starts, lastStart}=heardKey(tk); if(!H) continue;
    const tkKeys=tk.filter(t=>phonKey(t));
    for(const tpl of TEMPLATES.concat(aliasTemplates)){
      const r=alignTemplate(H, starts, tpl, lastStart);
      if(!(r.cost<1e8) || r.slots.length!==tpl.slots.length) continue;
      const len=r.slots.reduce((s,x)=>s+x.len,0), total=1-r.cost/len, minSlot=Math.min(...r.slots.map(s=>s.sim));
      const cover=(H.length-r.slots[0].from)/H.length;
      const startTok=starts.indexOf(r.slots[0].from);
      const lead=startTok<0?99:tkKeys.slice(0,startTok).filter(t=>!UNIT_SET.has(t)&&!FILLER.has(t)).length;
      results.push({id:tpl.id, total, minSlot, slots:r.slots, alias:!!tpl.alias, names:tpl.names, cover, rank: total+0.2*cover, lead, merged:!!(r.slots.merged)});
    }
  }
  if(!results.length) return null;
  results.sort((a,b)=>b.rank-a.rank);
  const best=results[0];
  if(opt&&opt.debug) return results.slice(0,3).map(r=>[r.id,+r.total.toFixed(2),+r.rank.toFixed(2),r.slots.map(x=>+x.sim.toFixed(2))]);
  if(best.total<clar.total || best.minSlot<clar.slot) return null;
  // execution slot must sound like an execution word (guards against stray words)
  const ex=best.slots[best.slots.length-1].sim;
  if(ex<Math.max(clar.slot,.6)) return null;
  if(best.slots.length<3 && !best.alias){
    // one prep word + execution: must be clean and must be the whole thing said (after a unit word / filler)
    if(best.minSlot<Math.max(.7,clar.slot) || ex<.8 || best.total<Math.max(.85,clar.total) || best.lead>0) return null;
  }
  const rival=results.find(r=>r.id!==best.id);
  if(rival && best.rank-rival.rank<clar.margin && !best.alias) return null;   // too close to call: ignore
  return {cmd:CMD[best.id], prep:"", score:+best.total.toFixed(2), via:best.alias?"your voice":"sound-alike", rival:rival&&rival.id, rivalScore:rival&&+rival.total.toFixed(2)};
}
/** Sound-alike prep with no execution word yet ("palm left" … pause … "harch"). Stricter. */
function fuzzyPrepOnly(text){
  const tok=normT(text).split(" ").filter(Boolean).slice(-5); if(!tok.length) return null;
  const {H,starts}=heardKey(tok); if(!H) return null;
  let best=null, second=null;
  for(const tpl of TEMPLATES){
    if(tpl.names[tpl.names.length-1]!=="xMARCH" || tpl.slots.length<3) continue;   // only multi-word movement preps
    const r=alignTemplate(H, starts, {slots:tpl.slots.slice(0,-1)});
    if(!(r.cost<1e8)) continue;
    const len=r.slots.reduce((s,x)=>s+x.len,0), total=1-r.cost/len, minSlot=Math.min(...r.slots.map(s=>s.sim));
    const e={id:tpl.id,total,minSlot};
    if(!best||total>best.total){ if(best&&best.id!==e.id) second=best; best=e; } else if(e.id!==best.id && (!second||total>second.total)) second=e;
  }
  if(!best || best.total<.78 || best.minSlot<.55 || (second && best.total-second.total<.1)) return null;
  return CMD[best.id];
}

rebuildAliasTemplates();
/** Exact parser first; sound-alike matcher second. Learned phrases from "Train my voice" count exactly. */
function parseCommand(text){
  const ns=parseNSteps(text,true); if(ns) return {cmd:ns, prep:"", score:1, via:"exact"};
  const n=normT(text);
  for(const [id,list] of Object.entries(userAliases)) for(const ph of list||[]){ const a=normT(ph); if(a && (n===a || n.endsWith(" "+a))) return {cmd:CMD[id], prep:"", score:1, via:"your voice"}; }
  const p=parseExact(text); if(p) return Object.assign(p,{score:1, via:"exact"});
  if(settings.clarity==="exact") return null;
  return fuzzyParse(text);
}
