"""Voiceover and sound effects for an episode.

Usage: python3 voice.py <episode> <seconds> <out.wav>

Reads `voice` ([{t, text, voice?, speed?}]) and `sfx` ([{t, sound}]) from episodes/<episode>/episode.json
and writes one mono 24 kHz track. Speech is Kokoro TTS (open weights, Apache-2.0), run locally;
the model files are downloaded once into tts/ (git-ignored). Default voice: am_michael (Mochi, the host).
make_reel.sh mixes this track over the music and ducks the music under the voice.
"""
import json, sys, urllib.request
from pathlib import Path
import numpy as np
import soundfile as sf

VIDEO = Path(__file__).resolve().parent
TTS = VIDEO / "tts"
SR = 24000
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = {"kokoro.onnx": "kokoro-v1.0.int8.onnx", "voices.bin": "voices-v1.0.bin"}
DEFAULT_VOICE = "am_michael"

def ensure_model():
    TTS.mkdir(exist_ok=True)
    for local, remote in FILES.items():
        if not (TTS / local).exists():
            print(f"downloading {remote} ...")
            urllib.request.urlretrieve(MODEL_URL + remote, TTS / local)

def beepclick():
    """Kelvin's signature sound: two calculator beeps and a register click."""
    t = np.arange(int(SR * 0.06)) / SR
    beep = (np.sign(np.sin(2 * np.pi * 1760 * t)) * 0.25 * np.exp(-t * 30)).astype(np.float32)
    gap = np.zeros(int(SR * 0.05), np.float32)
    rng = np.random.default_rng(3)
    n = int(SR * 0.03)
    click = (rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (SR * 0.004)) * 0.6).astype(np.float32)
    return np.concatenate([beep, gap, beep, gap, click])

SOUNDS = {"beepclick": beepclick}

def main(name, seconds, out_path):
    ep = json.loads((VIDEO / "episodes" / name / "episode.json").read_text())
    out = np.zeros(int(SR * seconds), np.float32)
    def put(t, a):
        i = int(t * SR)
        if i < len(out):
            out[i:i + len(a)] += a[: len(out) - i]
    if ep.get("voice"):
        ensure_model()
        from kokoro_onnx import Kokoro
        k = Kokoro(str(TTS / "kokoro.onnx"), str(TTS / "voices.bin"))
        for line in ep["voice"]:
            a, sr = k.create(line["text"], voice=line.get("voice", DEFAULT_VOICE), speed=line.get("speed", 1.05), lang="en-us")
            assert sr == SR
            end = line["t"] + len(a) / SR
            print(f"{line['t']:5.2f}-{end:5.2f}s  {line['text']}")
            put(line["t"], a.astype(np.float32))
    for s in ep.get("sfx", []):
        put(s["t"], SOUNDS[s["sound"]]())
    sf.write(out_path, out, SR)
    print(f"wrote {out_path}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("usage: python3 voice.py <episode> <seconds> <out.wav>")
    main(sys.argv[1], float(sys.argv[2]), sys.argv[3])
