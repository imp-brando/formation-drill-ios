/* ======================================================================
   NATIVE iOS VOICE BRIDGE (only when running inside the Formation Drill iOS app, ios/ in this repo).
   The app injects window.FGNative {start, stop, setGrammar, version} (WKUserScript → WKScriptMessageHandler)
   and calls window.FGN.* back with evaluateJavaScript. ONE AVAudioEngine mic tap feeds both Apple's
   SFSpeechRecognizer (on-device when the phone supports it, biased with the drill words sent below) and
   the loudness/pitch meter, so there's no mic handoff. Everything after the transcript (sound-alikes,
   chatter discard, PICAA, voice burst, '!' errors) stays in this game code.
   In Safari window.FGNative doesn't exist and none of this runs.
====================================================================== */
const BRIDGE = window.FGNative;
const NATIVE = !!(BRIDGE && typeof BRIDGE.start==="function");
/** Words the native recogniser may output: every word of every command phrase, plus [unk] for
    anything else (the iOS app uses the words as contextualStrings and ignores [unk]; chatter is discarded here). Sent from the web side so
    new commands don't need an app update. */
function nativeGrammar(){
  const words=new Set();
  for(const ph of GRAMMAR_PHRASES.concat(["cover","recover","platoon fall in","squad halt","flight halt","platoon halt","ten hut","as you were"])) ph.split(" ").forEach(w=>words.add(w));
  return JSON.stringify(GRAMMAR_PHRASES.concat(["cover","recover","as you were"], [...words], ["[unk]"]));
}
const FGN = {
  slot:0, partial:"", started:false,
  /** meter frame: dBFS level, pitch Hz (0 = unvoiced), age = ms since the end of the audio window */
  frame(db, hz, age){
    if(!micOK) return;
    const t=now()-(age||0);
    pushFrame(t, db, hz);
    noiseFloor = db<noiseFloor ? lerp(noiseFloor,db,.3) : lerp(noiseFloor,db,.004);
    noiseFloor = clamp(noiseFloor,-90,-35);
  },
  /** recogniser text: partial (isFinal=false) or final for the current utterance; alts = extra guesses */
  speech(text, isFinal, alts){
    if(!recOn) return;
    // [unk] = a word outside the drill grammar. Keep a marker in its place so "take cover" (→ "[unk] cover")
    // stays chatter instead of becoming COVER; an utterance of only [unk] is dropped silently.
    const clean=s=>{ s=String(s||"").replace(/\s+/g," ").trim(); return s.replace(/\[unk\]/g,"").trim() ? s.replace(/\[unk\]/g,"zzunk").trim() : ""; };
    const list=[clean(text)].concat((alts||[]).map(clean)).filter((s,i,a)=>s && a.indexOf(s)===i);
    if(!list.length){ if(isFinal) FGN.slot++; return; }
    if(!isFinal && list[0]===FGN.partial) return;
    FGN.partial = isFinal ? "" : list[0];
    const res=list.map(t=>({transcript:t, confidence:.9})); res.isFinal=!!isFinal;
    const results=[]; for(let i=0;i<=FGN.slot;i++) results[i]=res;
    handleResult({resultIndex:FGN.slot, results});
    if(isFinal){ FGN.slot++; sessionText=""; }
  },
  state(s, detail){            // "listening" | "stopped" | "denied" | "error" | "loading"
    if(s==="listening"){ FGN.started=true; setStatus("🎙 Listening · on-device recogniser · voice meter on","ok"); }
    else if(s==="loading") setStatus("🎙 Loading the on-device drill recogniser…","warn");
    else if(s==="denied"){ recOn=false; micOK=false; setStatus("Microphone or speech recognition permission denied. Allow both in Settings → Formation Drill.","bad"); flash("MICROPHONE BLOCKED","bad","Open Settings → Formation Drill and allow Microphone and Speech Recognition."); }
    else if(s==="error") setStatus("Voice error: "+(detail||"unknown"),"bad");
  },
};
window.FGN = FGN;
if(NATIVE){
  coexist="yes";                                   // one shared native stream: meter + recognition together
  try{ BRIDGE.setGrammar(nativeGrammar()); }catch(_){}
  startMic = async function(){ if(micMode==="rec") return false; micOK=true; meterOffReason=""; try{ BRIDGE.start(); }catch(_){ micOK=false; return false; } return true; };
  stopMic  = function(){ micOK=false; if(!recOn){ try{ BRIDGE.stop(); }catch(_){} } };
  setupMeter = async function(){ if(!micOK && micMode!=="rec") await startMic(); };
  startRecognition = function(){ recOn=true; recRunning=true; session++; sessionText=""; lastRecStart=now(); try{ BRIDGE.start(); }catch(_){ return false; } return true; };
  restartRec = function(){ if(recOn){ recRunning=true; try{ BRIDGE.start(); }catch(_){} } };
  burstAvailable = function(){ return execMode==="burst" && micMode!=="rec" && micOK && !G.over && G.mode!=="practice"; };
  const _stop=stopListening;
  stopListening = function(why){ _stop(why); try{ BRIDGE.stop(); }catch(_){} FGN.partial=""; };
  document.documentElement.classList.add("native-app");
  if(FG) FG.native=true;
}

/* ---------- Offline: service worker caches the game (network first, cached copy when there's no signal) ---------- */
if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  window.addEventListener("load", ()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}
