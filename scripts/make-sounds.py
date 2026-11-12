"""Render 6 nada pengingat ke WAV untuk kanal notifikasi Android (res/raw/noto_<id>.wav).
Padanan dari sintesis WebAudio di src/lib/sounds.ts. Jalankan: python3 scripts/make-sounds.py"""
import numpy as np, wave, os
SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'native', 'android-widget', 'res', 'raw')
os.makedirs(OUT, exist_ok=True)

def tone(buf, kind, f, t, dur, peak=0.5, att=0.005):
    n = int(dur * SR); x = np.arange(n) / SR
    ph = 2 * np.pi * f * x
    w = {'sine': np.sin(ph), 'triangle': 2 / np.pi * np.arcsin(np.sin(ph)), 'square': np.sign(np.sin(ph)), 'saw': 2 * ((f * x) % 1) - 1}[kind]
    env = np.minimum(x / max(att, 1e-4), 1) * np.exp(-x * (np.log(1 / 0.0001) / dur))
    s = int(t * SR); e = min(len(buf), s + n)
    buf[s:e] += (w * env * peak)[: e - s]

def make(name, length, f):
    buf = np.zeros(int(length * SR)); f(buf)
    buf = np.tanh(buf * 1.2); buf /= max(1e-6, np.abs(buf).max()) / 0.9
    fade = int(0.03 * SR); buf[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(os.path.join(OUT, f'noto_{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf * 32767).astype('<i2').tobytes())

def bell(b):
    for t, f in [(0, 659), (0.55, 523)]:
        for m, a in [(1, .5), (2.76, .22), (5.4, .1)]: tone(b, 'sine', f * m, t, 1.6, a)
def chime(b):
    for i, f in enumerate([880, 1109, 1319]): tone(b, 'triangle', f, i * .16, .9, .4); tone(b, 'sine', f * 2, i * .16, .5, .12)
def digital(b):
    for k in range(2):
        for i in range(3): tone(b, 'square', 1480, k * .6 + i * .12, .07, .18, .002)
def alarm(b):
    for r in range(2):
        for i in range(6): tone(b, 'saw', 660 if i % 2 else 880, r * 1.5 + i * .18, .17, .22, .004)
def ring(b):
    for k in range(2):
        n = int(.43 * SR); x = np.arange(n) / SR
        w = (np.sin(2 * np.pi * 440 * x) + np.sin(2 * np.pi * 480 * x)) * (0.75 + 0.25 * np.sin(2 * np.pi * 22 * x)) * .3
        w[: int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR)); s = int((k * .65) * SR); b[s:s + n] += w
def soft(b):
    for f, d in [(392, 0), (523, .22), (659, .44)]: tone(b, 'sine', f, d, .7, .45, .003); tone(b, 'sine', f * 4, d, .12, .1, .002)

for n, l, f in [('bell', 2.3, bell), ('chime', 1.5, chime), ('digital', 1.3, digital), ('alarm', 3.0, alarm), ('ring', 1.4, ring), ('soft', 1.5, soft)]:
    make(n, l, f)
print('ok', sorted(os.listdir(OUT)))
