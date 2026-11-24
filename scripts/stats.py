"""Colour statistics of frames: python stats.py frame1.jpg frame2.jpg ...
Prints luma mean, std, p2, p98 and mean saturation. Viral-style targets: day mean .43-.57; night needs p98 >= .85
(light sources); saturation .38-.65."""
import sys, numpy as np
from PIL import Image
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert("RGB").resize((180, 320))).astype(float) / 255
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    mx, mn = a.max(-1), a.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    print(f"{p}: mean {lum.mean():.2f}  std {lum.std():.2f}  p2 {np.percentile(lum, 2):.2f}  p98 {np.percentile(lum, 98):.2f}  sat {sat.mean():.2f}")
