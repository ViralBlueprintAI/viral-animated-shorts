"""Put a NEW read of the same script onto the timing of the OLD voice track, phrase by phrase, so that every shot,
animation and sound cue keyed to the old words still lands. Use it when the voice has to be regenerated after the short
is built (new plan, new voice, better take).

    python audio/realign.py old_words.json old_voice.wav new_read.mp3 voice_new.wav [--sr 48000] [--model small.en]

- old_words.json / old_voice.wav: the finished track and its word timings (from align.py).
- new_read: the new full read of the same text (any format ffmpeg reads), untouched.
The script transcribes the new read, matches its words to the old ones and cuts both tracks into phrases at the old
pauses. Phrase edges are taken from the waveform (where the speech really starts and stops), not from the transcript,
because single words can be 0.1-0.4 s off there. Every new phrase is time-stretched (ffmpeg atempo, pitch stays) to the
length of the old one and placed at its old start. At the end it measures how far every phrase still is from the old
track (envelope cross-correlation); check the keyed words with envelope.py afterwards."""
import sys, os, re, json, difflib, subprocess, tempfile, argparse
import numpy as np, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("old_words"); ap.add_argument("old_voice"); ap.add_argument("new_read"); ap.add_argument("out")
ap.add_argument("--sr", type=int, default=48000); ap.add_argument("--model", default="small.en")
ap.add_argument("--gap", type=float, default=0.15, help="minimum old pause (s) that may separate two phrases")
ap.add_argument("--tempo", type=float, default=1.0, help="speed the raw new read up first (the old track used 1.05)")
a = ap.parse_args()
SR = a.sr

def transcribe(path):
    from faster_whisper import WhisperModel
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = WhisperModel(a.model, device="cpu", compute_type="int8").transcribe(np.frombuffer(raw, np.float32), word_timestamps=True, beam_size=5)
    return [[w.start, w.end, w.word.strip()] for s in segs for w in s.words]
def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())
def load(path):
    tmp = os.path.join(tempfile.gettempdir(), "_realign_in.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), tmp], check=True)
    return sf.read(tmp)[0]
def stretch(x, tempo):
    """tempo > 1 makes it shorter; ffmpeg atempo keeps the pitch"""
    if abs(tempo - 1) < 0.004: return x
    t = tempfile.gettempdir(); i, o = os.path.join(t, "_ra_i.wav"), os.path.join(t, "_ra_o.wav")
    sf.write(i, x, SR, subtype="FLOAT")
    chain, r = [], tempo
    while r > 2.0: chain.append("atempo=2.0"); r /= 2.0
    while r < 0.5: chain.append("atempo=0.5"); r /= 0.5
    chain.append(f"atempo={r:.5f}")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", i, "-af", ",".join(chain), o], check=True)
    return sf.read(o)[0]

HOP = 0.005
def envdb(x):
    h = int(HOP * SR); n = len(x) // h
    e = np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9
    return 20 * np.log10(e / (np.percentile(e, 99) + 1e-9))
def edge(E, t_guess, lo, hi, first, thr=-28.0):
    """first frame (first=True) or last frame above thr between lo and hi seconds, nearest to the transcript guess"""
    a_, b_ = max(0, int(lo / HOP)), min(len(E) - 1, int(hi / HOP))
    idx = np.nonzero(E[a_:b_ + 1] > thr)[0]
    if not len(idx): return t_guess
    return (a_ + (idx[0] if first else idx[-1])) * HOP + (0 if first else HOP)

old = json.load(open(a.old_words))
x_old = load(a.old_voice); y = stretch(load(a.new_read), a.tempo)
if a.tempo != 1.0:
    sf.write(os.path.join(tempfile.gettempdir(), "_realign_new.wav"), y, SR); a.new_read = os.path.join(tempfile.gettempdir(), "_realign_new.wav")
Eo, En = envdb(x_old), envdb(y)
new = transcribe(a.new_read)
ot, nt = [norm(w[2]) for w in old], [norm(w[2]) for w in new]
m = {}
for blk in difflib.SequenceMatcher(None, ot, nt, autojunk=False).get_matching_blocks():
    for k in range(blk.size): m[blk.a + k] = blk.b + k
print(f"old words {len(old)}, new words {len(new)}, matched {len(m)}")

# phrases: break after punctuation where BOTH reads pause (old >= --gap, new >= 60 ms)
def brk(i):
    if not re.search(r"[.?!,;:]$", old[i][2]) or old[i + 1][0] - old[i][1] < a.gap: return False
    if i not in m or i + 1 not in m or m[i + 1] != m[i] + 1: return False
    return new[m[i + 1]][0] - new[m[i]][1] >= 0.06
phrases, i0 = [], 0
for i in range(len(old)):
    if i == len(old) - 1 or brk(i):
        phrases.append((i0, i)); i0 = i + 1
L = int((old[-1][1] + 1.0) * SR)
out = np.zeros(L)
fade = int(0.012 * SR); ramp = np.linspace(0, 1, fade)
report, placed = [], []
for k, (p0, p1) in enumerate(phrases):
    ins = [i for i in range(p0, p1 + 1) if i in m]
    if not ins: print("  ! phrase not found in the new read:", " ".join(w[2] for w in old[p0:p1 + 1])); continue
    j0, j1 = m[ins[0]], m[ins[-1]]
    # limits: halfway to the neighbouring phrases
    o_lo = (old[p0 - 1][1] + old[p0][0]) / 2 if p0 > 0 else 0.0
    o_hi = (old[p1][1] + old[p1 + 1][0]) / 2 if p1 + 1 < len(old) else len(x_old) / SR
    n_lo = (new[j0 - 1][1] + new[j0][0]) / 2 if j0 > 0 else 0.0
    n_hi = (new[j1][1] + new[j1 + 1][0]) / 2 if j1 + 1 < len(new) else len(y) / SR
    os_, oe = edge(Eo, old[p0][0], o_lo, old[p0][1], True), edge(Eo, old[p1][1], old[p1][0], o_hi, False)
    ns, ne = edge(En, new[j0][0], n_lo, new[j0][1], True), edge(En, new[j1][1], new[j1][0], n_hi, False)
    pre, post = min(0.04, ns - n_lo), min(0.10, n_hi - ne)
    seg = y[int((ns - pre) * SR): int((ne + post) * SR)].copy()
    tempo = (ne - ns) / max(0.05, oe - os_)
    if not 0.8 <= tempo <= 1.25: print(f"  ! strong stretch {tempo:.2f} at '{old[p0][2]} ... {old[p1][2]}'")
    seg = stretch(seg, tempo)
    seg[:fade] *= ramp; seg[-fade:] *= ramp[::-1]
    at = int((os_ - pre / tempo) * SR)
    if at < 0: seg = seg[-at:]; at = 0
    out[at: at + len(seg)] += seg[: max(0, L - at)]
    report.append((old[p0][2], tempo)); placed.append((os_, oe, " ".join(w[2] for w in old[p0:p1 + 1])))
sf.write(a.out, out, SR, subtype="PCM_16")
print(f"{len(phrases)} phrases, tempo {min(r[1] for r in report):.2f}..{max(r[1] for r in report):.2f} -> {a.out}")

# check: envelope cross-correlation per phrase (positive = new is late)
Eout = envdb(out); offs = []
for s0, s1, txt in placed:
    i_, j_ = int(s0 / HOP), int(s1 / HOP)
    if j_ - i_ < 20: continue
    ref = np.clip(Eo[i_:j_], -60, 0); best, bl = -1e9, 0
    for lag in range(-30, 31):
        seg = np.clip(Eout[i_ + lag:j_ + lag], -60, 0)
        if len(seg) != len(ref): continue
        c = np.corrcoef(ref, seg)[0, 1]
        if c > best: best, bl = c, lag
    offs.append((abs(bl) * HOP, bl * HOP, best, s0, txt[:40]))
offs.sort(reverse=True)
print(f"phrase offset: median {np.median([o[0] for o in offs]) * 1000:.0f} ms, max {offs[0][0] * 1000:.0f} ms")
for o in offs[:5]: print(f"  {o[1] * 1000:+.0f} ms (r={o[2]:.2f}) at {o[3]:.2f}: {o[4]}")
