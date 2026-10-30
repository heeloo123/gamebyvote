#!/usr/bin/env bash
# Records composer.html (game + captions) and encodes an Instagram-ready 1080x1920 Reel.
set -euo pipefail
cd "$(dirname "$0")"
python3 record.py
ffmpeg -y -v error -f concat -safe 0 -i out/concat.txt -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 18 -movflags +faststart -an out/reel.mp4
echo "Done: out/reel.mp4"
