#!/usr/bin/env python3
"""Pre-render voiced cadences: drill sergeant call (one deep, processed voice) + platoon response
(8 layered male voices: random pitch, small time offsets, light reverb).  Every half-line is
time-fitted to exactly 4 steps and packed into one sprite per cadence and tempo variant:
audio/cadence/<id>-<variant>.mp3, half n starts at n * slotSamples (line i: call 2i, response 2i+1).
Run with the piper venv:  /home/box/piperenv/bin/python tools/gen_cadence.py /tmp/ci/cadences.json
"""
import json, os, sys, wave, subprocess, random, hashlib, tempfile
import numpy as np
from piper import PiperVoice, SynthesisConfig

VOX = "/home/box/piper-voices"
DS_VOICE = "en_US-ryan-high"
GROUP = ["en_US-hfc_male-medium","en_US-joe-medium","en_US-john-medium","en_US-bryce-medium",
         "en_US-kusal-medium","en_US-norman-medium","en_GB-alan-medium","en_GB-northern_english_male-medium"]
SR = 22050
VARIANTS = {"q116":116, "q136":136, "d180":180}       # beats per minute; one half-line = 4 beats
OUT = os.path.join(os.path.dirname(__file__), "..", "audio", "cadence")
TMP = tempfile.mkdtemp(prefix="cad")
random.seed(7)

def ff(*args):
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y",*args], check=True)
def read(path):
    with wave.open(path) as w:
        a=np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)/32768
        assert w.getframerate()==SR, (path, w.getframerate())
    return a
def write(path, a):
    with wave.open(path,"wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a,-1,1)*32767).astype(np.int16).tobytes())
def dur(path): return len(read(path))/SR
def atempo(f):
    # chain atempo filters to stay inside 0.5..2.0
    parts=[]
    while f>2.0: parts.append("atempo=2.0"); f/=2.0
    while f<0.5: parts.append("atempo=0.5"); f/=0.5
    parts.append(f"atempo={f:.5f}"); return ",".join(parts)

voices={}
def synth(vname, text, length_scale):
    key=hashlib.md5(f"{vname}|{text}|{length_scale}".encode()).hexdigest()[:12]
    raw=f"{TMP}/raw-{key}.wav"
    if not os.path.exists(raw):
        if vname not in voices: voices[vname]=PiperVoice.load(f"{VOX}/{vname}.onnx")
        with wave.open(f"{TMP}/syn.wav","wb") as w:
            voices[vname].synthesize_wav(text.replace("…",","), w, syn_config=SynthesisConfig(length_scale=length_scale, noise_scale=0.6, noise_w_scale=0.7))
        # resample to SR mono, trim leading/trailing silence
        trim="silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse"
        ff("-i",f"{TMP}/syn.wav","-af",f"aresample={SR},{trim}","-ac","1","-ar",str(SR),raw)
    return raw

def ds_clip(text):
    raw=synth(DS_VOICE, text, 0.92)
    out=f"{TMP}/ds-{hashlib.md5(text.encode()).hexdigest()[:10]}.wav"
    p=0.90   # deeper: pitch down 10%, keep length
    af=(f"asetrate={int(SR*p)},aresample={SR},{atempo(1/p)},highpass=f=70,"
        "equalizer=f=140:t=q:w=1:g=4,equalizer=f=2600:t=q:w=1.2:g=5,"
        "acompressor=threshold=-20dB:ratio=5:attack=4:release=80:makeup=3,"
        "aecho=0.85:0.5:28:0.12,alimiter=limit=0.9")
    ff("-i",raw,"-af",af,out); return out

def group_clip(text, target):
    out=f"{TMP}/gr-{hashlib.md5(text.encode()).hexdigest()[:10]}.wav"
    takes=[]
    for i,v in enumerate(GROUP):
        raw=synth(v, text, 0.95)
        lead = i==0                                   # one clear lead voice keeps the words readable
        d=dur(raw); p=1.0 if lead else random.uniform(0.96,1.035); off=0.0 if lead else random.uniform(0.008,0.032)
        t=f"{TMP}/take-{i}.wav"
        # same length as the call, own pitch, slight lag
        af=f"{atempo(d/target)},asetrate={int(SR*p)},aresample={SR},{atempo(1/p)},adelay={int(off*1000)}"
        ff("-i",raw,"-af",af,t); takes.append(read(t))
    n=max(len(a) for a in takes); mix=np.zeros(n,np.float32)
    for i,a in enumerate(takes): mix[:len(a)]+=a*(1.0 if i==0 else random.uniform(0.26,0.38))
    mix/=max(1e-6,np.abs(mix).max()); write(f"{TMP}/mix.wav", mix*0.9)
    af=("highpass=f=90,aecho=0.8:0.5:40|75:0.16|0.1,"
        "acompressor=threshold=-18dB:ratio=4:attack=6:release=90:makeup=2,alimiter=limit=0.9")
    ff("-i",f"{TMP}/mix.wav","-af",af,out); return out

def fit(path, slot):
    """Stretch so the words fill the 4-step slot from its first sample (left foot strike).
       Short phrases are not slowed below 0.75x; the rest of their slot is their natural tail."""
    d=dur(path); f=max(0.75, min(2.2, d/slot))
    t=f"{TMP}/fit.wav"; ff("-i",path,"-af",atempo(f),t)
    a=read(t); n=round(slot*SR)
    a=a[:n] if len(a)>=n else np.concatenate([a,np.zeros(n-len(a),np.float32)])
    fade=int(0.012*SR); a[-fade:]*=np.linspace(1,0,fade)      # no click at the slot edge
    return a

def main():
    cads=json.load(open(sys.argv[1])); os.makedirs(OUT, exist_ok=True)
    only=sys.argv[2:] or None
    for c in cads:
        if only and c["id"] not in only: continue
        halves=[]
        for ln in c["lines"]:
            ds=ds_clip(ln["c"]); gr=group_clip(ln["r"], dur(ds) if ln["r"]==ln["c"] else dur(synth(DS_VOICE, ln["r"], 0.92)))
            halves+= [ds, gr]
        for var,bpm in VARIANTS.items():
            slot=4*60/bpm
            sprite=np.concatenate([fit(h, slot) for h in halves])
            peak=np.abs(sprite).max(); sprite*=0.89/max(peak,1e-6)
            write(f"{TMP}/sprite.wav", sprite)
            ff("-i",f"{TMP}/sprite.wav","-codec:a","libmp3lame","-b:a","32k","-ar",str(SR),"-ac","1",f"{OUT}/{c['id']}-{var}.mp3")
            if c["id"]=="c130" and var=="q116":     # sample for the player: line 1 call + response
                write(f"{TMP}/sample.wav", sprite[:2*round(slot*SR)])
        print(c["id"], len(halves), "halves", flush=True)
    if os.path.exists(f"{TMP}/sample.wav"):
        ff("-i",f"{TMP}/sample.wav","-codec:a","libmp3lame","-b:a","96k",os.path.join(os.path.dirname(__file__),"..","shots","cadence-sample.mp3"))
main()
