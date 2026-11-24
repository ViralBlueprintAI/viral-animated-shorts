"""Final sound of a short: voice + ONE music track + real sound effects, mastered to -14 LUFS / -1 dBTP.

    python audio/sfxmix.py example/cues.json            (paths inside the json are relative to the json file)

cues.json
  {"voice": "voice_final.wav", "music": "track.mp3", "sfxdir": "sfx", "out": "mix_final.wav", "dur": 72.7,
   "music_lu": -10.0,                       # music bed this many LU under the voice (before ducking)
   "duck": {"music": 0.45, "amb": 0.35, "sfx": 0.12},   # how much each layer dips while the narrator talks
   "cues": [ ... ]}

Cue kinds (times in seconds of the final video):
  {"s": "gavel2", "t": 26.95, "hit": 0.0, "g": -2, "mode": "pk", "a": 0, "b": 1.2, "fo": 0.4}
        one sample from sfxdir/<s>.wav (or .flac). Its point `hit` (seconds into the file: the impact, the peak of a
        whoosh, the landing of a purse) is placed exactly on `t`. `a`/`b` trim the file, `fo` fade-out, `lpf` low-pass.
        Level `g` in dB relative to the narrator: mode "rms" compares the loudest 400 ms of the sample with loud speech,
        mode "pk" compares peaks (use it for very short hits: gavel, hammer, pop).
  {"bed": "crowd1", "t0": 0.0, "t1": 4.9, "g": -17, "xf": 0.6, "fi": 0.8, "fo": 0.8}
        an ambience looped with crossfades between t0 and t1 (crowd, night, torches, footsteps). Goes to the amb layer.
  {"synth": "heartbeat", "t0": 12.4, "t1": 14.3, "bpm0": 66, "bpm1": 72, "gain": 0.25}
  {"synth": "shimmer", "t": 51.9, "dur": 2.0, "base": 440, "gain": 0.35}
  {"synth": "birds" | "murmur" | "wind" | "crickets", "t0": 5.0, "t1": 16.5, "gain": 0.18}
        small synthesised helpers for things no sample is needed for.
Level guide (viral-short style, measured as momentary loudness against the narrator): key impacts -1..-6 LU, foley -8..-12,
whooshes -10..-12, single small sounds -12..-15, ambiences -15..-25.
"""
import sys, os, json, subprocess, re
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.ndimage import uniform_filter1d
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsp import bp, lp, hp, SR, rng

spec_path = sys.argv[1]
spec = json.load(open(spec_path))
base = os.path.dirname(os.path.abspath(spec_path))
P = lambda p: p if os.path.isabs(p) else os.path.join(base, p)

def load(path, ch=2):
    tmp = "/tmp/_sfxmix_load.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), tmp], check=True)
    x, _ = sf.read(tmp, always_2d=True)
    return x

voice = load(P(spec["voice"]), 1)[:, 0]
DUR = float(spec.get("dur", len(voice) / SR + 0.5)); N = int(DUR * SR)
v = np.zeros(N); v[: min(N, len(voice))] = voice[:N]
EV = np.zeros((N, 2)); AM = np.zeros((N, 2))
W4 = int(0.4 * SR)
vr = np.sqrt(np.convolve(v ** 2, np.ones(W4) / W4, "same"))
VREF_RMS = 20 * np.log10(np.percentile(vr[vr > 1e-3], 90))
VREF_PK = 20 * np.log10(np.abs(v).max())

_cache = {}
def S(name):
    if name not in _cache:
        d = P(spec.get("sfxdir", "sfx"))
        f = next((os.path.join(d, name + e) for e in (".wav", ".flac", ".mp3") if os.path.exists(os.path.join(d, name + e))), None)
        if not f: raise SystemExit(f"missing sound effect: {name} in {d}")
        _cache[name] = load(f, 2)
    return _cache[name]
def norm(x, mode, g):
    m = x.mean(1)
    if mode == "pk": cur, ref = 20 * np.log10(np.abs(x).max() + 1e-9), VREF_PK
    else: cur, ref = 20 * np.log10(np.sqrt(np.convolve(m ** 2, np.ones(W4) / W4, "same")).max() + 1e-9), VREF_RMS
    return x * 10 ** ((ref + g - cur) / 20)
def cut(x, a=0.0, b=None, fi=0.003, fo=0.08):
    y = x[int(a * SR): (int(b * SR) if b else None)].copy(); n = len(y)
    FI, FO = int(fi * SR), min(int(fo * SR), n)
    if FI: y[:FI] *= np.linspace(0, 1, FI)[:, None]
    if FO: y[-FO:] *= np.linspace(1, 0, FO)[:, None]
    return y
def put(dst, x, t):
    if x.ndim == 1: x = np.stack([x, x], 1)
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(len(dst), i + len(x))
    if j > i: dst[i:j] += x[: j - i]

# --- small synthesised helpers (mono, dsp.py filters) ---
def thud(f=60):
    n = int(0.6 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 40 * np.exp(-t * 20)) * t) * np.exp(-t * 9) + lp(rng.standard_normal(n), 400) * np.exp(-t * 18) * 0.5
def heartbeat(t0, t1, bpm0, bpm1, gain):
    t = t0
    while t < t1:
        bpm = bpm0 + (bpm1 - bpm0) * (t - t0) / (t1 - t0)
        put(EV, thud(48) * 0.8 * gain * 0.5, t); put(EV, thud(42) * 0.5 * gain * 0.5, t + 0.22); t += 60 / bpm
def shimmer(t, dur, base_f, gain):
    n = int(dur * SR); x = np.zeros(n)
    for k in range(14):
        f = base_f * 2 ** (rng.integers(0, 24) / 12); i = int(rng.uniform(0, dur * 0.5) * SR); tt = np.arange(n - i) / SR
        x[i:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 4) * 0.12
    put(EV, x * gain * 0.5, t)
def fade1(x, a, b):
    A, B = int(a * SR), int(b * SR); x[:A] *= np.linspace(0, 1, A); x[-B:] *= np.linspace(1, 0, B); return x
def birds(t0, t1, gain):
    t = t0
    while t < t1:
        n = int(0.18 * SR); tt = np.arange(n) / SR
        f = rng.uniform(2500, 4200) + 900 * np.sin(2 * np.pi * rng.uniform(8, 16) * tt)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / tt[-1]) ** 2
        for k in range(rng.integers(1, 4)): put(AM, x * gain * rng.uniform(0.4, 1) * 0.45, t + k * 0.21)
        t += rng.uniform(0.7, 2.2)
def murmur(t0, t1, gain):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 250, 1600) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 0.7 * tt + np.sin(tt * 1.3))))
    put(AM, fade1(x, 0.6, 0.6) * gain * 0.45, t0)
def wind(t0, t1, gain):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR
    put(AM, fade1(lp(rng.standard_normal(n), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.15 * tt)), 0.8, 0.8) * gain * 0.45, t0)
def crickets(t0, t1, gain):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * 4300 * tt) * (np.sin(2 * np.pi * 30 * tt) > 0.3) * (np.sin(2 * np.pi * 1.3 * tt) > -0.2)
    x2 = np.sin(2 * np.pi * 4700 * tt) * (np.sin(2 * np.pi * 26 * tt + 1) > 0.4) * (np.sin(2 * np.pi * 0.9 * tt + 2) > 0)
    put(AM, fade1(x * 0.5 + x2 * 0.4, 0.5, 0.5) * gain * 0.45, t0)

for c in spec["cues"]:
    if "s" in c:
        x = cut(S(c["s"]), c.get("a", 0.0), c.get("b"), fo=c.get("fo", 0.08))
        if c.get("lpf"): x = np.stack([lp(x[:, 0], c["lpf"]), lp(x[:, 1], c["lpf"])], 1)
        put(EV, norm(x, c.get("mode", "rms"), c.get("g", -8)), c["t"] - (c.get("hit", 0.0) - c.get("a", 0.0)))
    elif "bed" in c:
        x = norm(cut(S(c["bed"]), c.get("a", 0.0), c.get("b"), 0.0, 0.0), "rms", c.get("g", -20))
        L = len(x); XF = int(c.get("xf", 0.6) * SR); n = int((c["t1"] - c["t0"]) * SR); out = np.zeros((n, 2)); i = 0
        win = np.ones(L); win[:XF] = np.linspace(0, 1, XF); win[-XF:] = np.linspace(1, 0, XF)
        while i < n:
            j = min(n, i + L); out[i:j] += (x * win[:, None])[: j - i]; i += L - XF
        FI, FO = int(c.get("fi", 0.8) * SR), int(c.get("fo", 0.8) * SR)
        out[:FI] *= np.linspace(0, 1, FI)[:, None]; out[-FO:] *= np.linspace(1, 0, FO)[:, None]
        put(AM, out, c["t0"])
    elif c.get("synth") == "heartbeat": heartbeat(c["t0"], c["t1"], c["bpm0"], c["bpm1"], c.get("gain", 0.3))
    elif c.get("synth") == "shimmer": shimmer(c["t"], c.get("dur", 1.6), c.get("base", 520), c.get("gain", 0.35))
    elif c.get("synth") in ("birds", "murmur", "wind", "crickets"): globals()[c["synth"]](c["t0"], c["t1"], c.get("gain", 0.1))
    else: raise SystemExit(f"unknown cue: {c}")

# --- music: one continuous track, out with the last word ---
meter = pyln.Meter(SR); lv0 = meter.integrated_loudness(v)
M = np.zeros((N, 2))
if spec.get("music"):
    tr = load(P(spec["music"]), 2); n = min(N, len(tr)); M[:n] = tr[:n]
    fo = int(1.6 * SR); M[N - fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]
    M *= 10 ** (((lv0 + spec.get("music_lu", -10.0)) - meter.integrated_loudness(M)) / 20)
env = uniform_filter1d(np.abs(v), int(0.05 * SR))
act = np.clip(env / (np.percentile(env[env > 0], 60) + 1e-9), 0, 1)
dk = spec.get("duck", {"music": 0.45, "amb": 0.35, "sfx": 0.12})
duck = lambda d: uniform_filter1d(1.0 - d * act, int(0.15 * SR))[:, None]
mix = np.stack([v, v], 1) + M * duck(dk["music"]) + AM * duck(dk["amb"]) + EV * duck(dk["sfx"])
mix *= 10 ** ((-14.0 - meter.integrated_loudness(mix)) / 20)
raw = "/tmp/_sfxmix_raw.wav"; sf.write(raw, mix, SR, subtype="FLOAT")

# --- master: brickwall limiter, trim the gain until -14.0 LUFS integrated ---
out = P(spec.get("out", "mix_final.wav")); gain = 0.0
def measure(f):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = r[r.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+)", tail).group(1)), float(re.search(r"Peak:\s+(-?[\d.]+)", tail).group(1))
for _ in range(4):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.87:attack=4:release=60:level=disabled",
                    "-c:a", "pcm_s16le", out], check=True)
    I, TP = measure(out)
    if abs(I + 14.0) <= 0.05: break
    gain += -14.0 - I
print(f"voice {lv0:.1f} LUFS -> mix {I:.1f} LUFS, true peak {TP:.1f} dBFS -> {out}")
