# Reel pipeline

Turns the game into a vertical Instagram Reel automatically.

- `composer.html`: the game plus caption overlays, intro card and vote card.
- `record.py`: plays a timeline (captions + taps) in a headless browser and captures frames at 1080x1920.
- `make_reel.sh`: runs the recording and encodes `out/reel.mp4` with FFmpeg.

Each episode: edit the captions/vote options in `composer.html` and the timeline in `record.py`, then run `./make_reel.sh`.

Needs: Python with Playwright (+ Chromium), FFmpeg, Node (`npm install` for the Fredoka font).
`composer.html` expects the game at `game/index.html` next to it (copy or symlink `../index.html`).
