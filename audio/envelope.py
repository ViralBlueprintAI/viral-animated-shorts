"""ASCII loudness envelope of a voice file between two times, 20 ms per character:
python envelope.py voice.wav 28.0 30.0      ' ' silence  '.' breath  ':' soft  '|' speech"""
import sys, numpy as np, soundfile as sf
x, sr = sf.read(sys.argv[1]); x = x.mean(1) if x.ndim > 1 else x
t0, t1 = float(sys.argv[2]), float(sys.argv[3]); hop = 0.02
e = [20 * np.log10(np.sqrt(np.mean(x[int(t * sr):int((t + hop) * sr)] ** 2)) + 1e-9) for t in np.arange(t0, t1, hop)]
line = "".join(" " if v < -45 else "." if v < -35 else ":" if v < -28 else "|" for v in e)
for k in range(0, len(line), 50): print(f"{t0 + k * hop:7.2f} {line[k:k + 50]}")
