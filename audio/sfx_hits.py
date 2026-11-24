"""Look at a folder of downloaded sound effects before you place them.

    python audio/sfx_hits.py sfx/                 -> table + sfx/_sheet.png (spectrogram + level of every file)

For every file it prints the length, the loudest moment (`peak`: use it as "hit" for whooshes and booms), the sharp
onsets (use the right one as "hit" for impacts: gavel, door, landing purse, fall), the loudest 400 ms in dBFS and the
brightness. Pick the variant whose shape matches the moment: one clean hit for a gavel, one rise into one impact for a
boom, a steady texture for an ambience. Rename the keepers to short names (gavel1.wav, boom2.wav ...)."""
import sys, os, glob, numpy as np, soundfile as sf

d = sys.argv[1]
files = sorted(f for e in ("wav", "flac", "mp3") for f in glob.glob(os.path.join(d, "*." + e)))
rows = []
for f in files:
    x, sr = sf.read(f, always_2d=True); m = x.mean(1)
    hop = int(0.005 * sr); e = np.sqrt(np.convolve(m ** 2, np.ones(hop) / hop, "same"))[::hop]; edb = 20 * np.log10(e + 1e-7)
    ons = []
    for i in range(4, len(edb)):
        if edb[i] - edb[i - 4] > 12 and edb[i] > edb.max() - 25 and (not ons or i * 0.005 - ons[-1] > 0.12): ons.append(round(i * 0.005, 3))
    w = int(0.4 * sr); r = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, "same"))
    S = np.abs(np.fft.rfft(m * np.hanning(len(m)))); fr = np.fft.rfftfreq(len(m), 1 / sr)
    rows.append((os.path.basename(f), len(m) / sr, np.argmax(e) * 0.005, ons[:6], 20 * np.log10(r.max() + 1e-9), (S * fr).sum() / S.sum()))
    print(f"{rows[-1][0]:28s} {rows[-1][1]:5.2f}s  peak@{rows[-1][2]:.3f}  onsets {rows[-1][3]}  loud400 {rows[-1][4]:6.1f} dB  bright {rows[-1][5]:5.0f} Hz")
try:
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    cols = 4; n = len(files); fig, axs = plt.subplots((n + cols - 1) // cols, cols, figsize=(16, 2.1 * ((n + cols - 1) // cols)), squeeze=False)
    for ax, f in zip(axs.flat, files):
        x, sr = sf.read(f, always_2d=True); m = x.mean(1)
        ax.specgram(m, NFFT=1024, Fs=sr, noverlap=768, cmap="magma", vmin=-120); ax.set_ylim(0, 12000); ax.set_title(os.path.basename(f), fontsize=9)
        hop = 480; env = np.sqrt(np.convolve(m ** 2, np.ones(hop) / hop, "same"))[::hop]
        a2 = ax.twinx(); a2.plot(np.arange(len(env)) * hop / sr, 20 * np.log10(env + 1e-6), "c", lw=0.8); a2.set_ylim(-70, 0); a2.set_yticks([])
        ax.tick_params(labelsize=6)
    for ax in list(axs.flat)[n:]: ax.axis("off")
    plt.tight_layout(); out = os.path.join(d, "_sheet.png"); plt.savefig(out, dpi=60); print("->", out)
except ImportError:
    pass
