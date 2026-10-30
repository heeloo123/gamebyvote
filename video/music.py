"""Original chiptune background track (royalty-free, generated from scratch).

Usage: python3 music.py SECONDS OUT.wav
Cheerful I-vi-IV-V loop in C major: square-wave lead, triangle bass, square arpeggio, noise hi-hats.
"""
import sys, wave
import numpy as np

SR = 44100
BPM = 112
BEAT = 60 / BPM
STEP = BEAT / 4                      # 16th note

def note_hz(n):                      # MIDI note number -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def square(f, t, duty=0.5):
    return np.where((t * f) % 1.0 < duty, 1.0, -1.0)

def triangle(f, t):
    return 2 * np.abs(2 * ((t * f) % 1.0) - 1) - 1

def env(n, attack=0.005, release=0.06):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if r and r < n: e[-r:] = np.linspace(1, 0, r)
    return e

def render(seconds):
    total = int(seconds * SR)
    mix = np.zeros(total + SR)
    chords = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62])]   # C Am F G
    # 16 sixteenths per bar; lead motif per bar (None = rest), MIDI notes in C major pentatonic
    motifs = [
        [72, None, 76, None, 79, None, 76, 74, 72, None, None, None, 74, None, 76, None],
        [76, None, 72, None, 69, None, 72, None, 74, None, 72, None, None, None, None, None],
        [72, None, 69, None, 72, None, 74, 76, 77, None, 76, None, 74, None, 72, None],
        [74, None, 76, None, 79, None, 81, None, 79, None, None, None, 76, None, 74, None],
    ]
    bar = 0
    pos = 0.0
    while pos < seconds:
        bass, triad = chords[bar % 4]
        motif = motifs[bar % 4] if bar >= 1 else [None] * 16       # first bar: no melody (intro)
        for s in range(16):
            t0 = pos + s * STEP
            i0 = int(t0 * SR)
            if i0 >= total: break
            n = int(STEP * SR)
            t = np.arange(n) / SR
            # arpeggio (soft 12.5% duty square)
            arp = triad[s % 3] + 12
            mix[i0:i0 + n] += 0.07 * square(note_hz(arp), t, 0.125) * env(n, release=0.03)
            # bass on quarter notes, octave bounce
            if s % 4 == 0:
                nb = int(BEAT * SR)
                tb = np.arange(nb) / SR
                b = bass + (12 if s % 8 == 4 else 0)
                mix[i0:i0 + nb] += 0.22 * triangle(note_hz(b), tb) * env(nb, release=0.08)
            # hi-hat on off-beats
            if s % 2 == 1:
                nh = int(0.03 * SR)
                mix[i0:i0 + nh] += 0.05 * np.random.uniform(-1, 1, nh) * np.linspace(1, 0, nh)
            # lead
            m = motif[s]
            if m is not None:
                nl = int(STEP * 2 * SR)
                tl = np.arange(nl) / SR
                vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * tl)
                mix[i0:i0 + nl] += 0.12 * square(note_hz(m) * vib, tl, 0.25) * env(nl, release=0.05)
        pos += 16 * STEP
        bar += 1
    out = mix[:total]
    fade = int(0.8 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    out[:int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
    out = out / max(1e-9, np.abs(out).max()) * 0.8
    return out

if __name__ == "__main__":
    np.random.seed(3)
    secs, path = float(sys.argv[1]), sys.argv[2]
    audio = (render(secs) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(audio.tobytes())
    print(f"wrote {path} ({secs:.1f}s)")
