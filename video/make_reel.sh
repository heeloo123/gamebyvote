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
if grep -q '"voice"\|"sfx"' "episodes/$EP/episode.json"; then
  # voiceover + sound effects over the music; the music ducks under the voice
  python3 voice.py "$EP" "$DUR" out/voice.wav
  AUDIO='[1:a]aresample=44100,volume=0.35[m];[2:a]aresample=44100,volume=1.6,asplit=2[vk][vo];[m][vk]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[md];[md][vo]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
  EXTRA=(-i out/voice.wav)
else
  AUDIO='[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]'
  EXTRA=()
fi
ffmpeg -y -v error -f concat -safe 0 -i out/concat.txt -i out/music.wav "${EXTRA[@]}" \
  -filter_complex "[0:v]fps=30,format=yuv420p[v];$AUDIO" -map "[v]" -map "[a]" \
  -c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 160k -ar 44100 \
  -shortest -movflags +faststart "../reels/$EP.mp4"
rm -rf out                                # frames and music are intermediate; the Reel is the output
echo "Done: reels/$EP.mp4"
