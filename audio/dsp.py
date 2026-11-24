"""Small DSP helpers shared by the audio scripts."""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(1518)

def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, fc, order=2): return sosfilt(butter(order, fc, btype="low", fs=SR, output="sos"), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, btype="high", fs=SR, output="sos"), x)
