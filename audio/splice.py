"""Replace sentences inside a finished voice track without touching the rest of its timing.
python splice.py spec.json
spec = {"base": "voice_final.wav", "out": "voice_new.wav", "tempo": 1.05,
        "zero": [[4.80, 9.40]],                                  # silence these spans of the base first
        "put": [{"clip": "new.mp3", "from": 5.40, "to": 5.78, "at": 5.07, "gain_db": 0}]}
"from"/"to" are times in the clip AFTER the tempo change; cut at pauses (see envelope.py). 12 ms fades on every edge."""
import sys, json, subprocess, os, tempfile, numpy as np, soundfile as sf
spec = json.load(open(sys.argv[1]))
y, sr = sf.read(spec["base"]); y = y.mean(1) if y.ndim > 1 else y.copy()
n = int(0.012 * sr); ramp = np.linspace(0, 1, n)
for a, b in spec.get("zero", []):
    ia, ib = int(a * sr), int(b * sr); y[ia - n:ia] *= ramp[::-1]; y[ib:ib + n] *= ramp; y[ia:ib] = 0
cache = {}
for p in spec["put"]:
    if p["clip"] not in cache:
        tmp = os.path.join(tempfile.gettempdir(), "splice_" + os.path.basename(p["clip"]) + ".wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", p["clip"], "-af", f"aresample={sr},atempo={spec.get('tempo', 1.0)}", "-ac", "1", tmp], check=True)
        cache[p["clip"]] = sf.read(tmp)[0]
    z = cache[p["clip"]][int(p["from"] * sr):int(p["to"] * sr)].copy() * 10 ** (p.get("gain_db", 0) / 20)
    z[:n] *= ramp; z[-n:] *= ramp[::-1]
    i = int(p["at"] * sr); y[i:i + len(z)] += z
sf.write(spec["out"], y, sr, subtype="PCM_16")
print("->", spec["out"])
