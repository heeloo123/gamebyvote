#!/usr/bin/env bash
# Builds one episode's Reel: ./make_reel.sh <episode>   (e.g. ./make_reel.sh day0)
# Records composer.html with episodes/<episode>/episode.json, adds the original chiptune track,
# and writes ../reels/<episode>.mp4 (1080x1920, 30 fps, H.264 + AAC), where the scheduler fetches it.
set -euo pipefail
cd "$(dirname "$0")"
EP="${1:?usage: ./make_reel.sh <episode>}"
python3 record.py "$EP"
DUR=$(cat out/duration.txt)
python3 music.py "$DUR" out/music.wav
mkdir -p ../reels
ffmpeg -y -v error -f concat -safe 0 -i out/concat.txt -i out/music.wav \
  -vf "fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 18 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 160k -ar 44100 \
  -shortest -movflags +faststart "../reels/$EP.mp4"
rm -rf out                                # frames and music are intermediate; the Reel is the output
echo "Done: reels/$EP.mp4"
