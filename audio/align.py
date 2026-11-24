"""Word timings for a voice file: python align.py voice.wav words.json [model]
Writes [[start, end, word], ...] (seconds). Uses faster-whisper (pip install faster-whisper) and ffmpeg.
Whisper can be ~0.4 s off on single words: check every word you key an animation to with envelope.py."""
import sys, subprocess, json, numpy as np
from faster_whisper import WhisperModel
src, out = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "small.en"
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32)
segs, _ = WhisperModel(model, device="cpu", compute_type="int8").transcribe(audio, word_timestamps=True, beam_size=5)
words = [[round(w.start, 2), round(w.end, 2), w.word.strip()] for s in segs for w in s.words]
json.dump(words, open(out, "w"))
print(len(words), "words ->", out)
