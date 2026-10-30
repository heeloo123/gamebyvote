# Reel pipeline

Turns the game into a vertical Instagram Reel (1080x1920, 30 fps, with music) automatically.

- `composer.html`: loads the game styles from `../styles/` and adds the captions, style badges, intro card and vote card.
- `record.py`: plays a timeline (captions, style switches, taps) in headless Chromium and captures real frames.
- `music.py`: generates an original chiptune track, so Reels have royalty-free sound.
- `make_reel.sh`: runs all of the above and writes `out/reel.mp4`.
- `episodes/`: the caption for each episode.

Each episode: edit the captions and vote card in `composer.html` and the `TIMELINE` / `TAPS` in `record.py`, then run `./make_reel.sh`.

Needs Python with Playwright (and Chromium), NumPy, FFmpeg, and `npm install` here for the Fredoka caption font.
