#!/usr/bin/env bash
# Records composer.html, adds the original chiptune track, and encodes an Instagram-ready Reel:
# 1080x1920, 30 fps, H.264 + AAC -> out/reel.mp4
set -euo pipefail
cd "$(dirname "$0")"
python3 record.py
DUR=$(cat out/duration.txt)
python3 music.py "$DUR" out/music.wav
ffmpeg -y -v error -f concat -safe 0 -i out/concat.txt -i out/music.wav \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 18 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 160k -ar 44100 \
  -shortest -movflags +faststart out/reel.mp4
echo "Done: out/reel.mp4"
