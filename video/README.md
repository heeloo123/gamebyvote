# Reel pipeline

Turns the game into a vertical Instagram Reel (1080x1920, 30 fps, with music) and a matching Story graphic.

## Make an episode
1. Copy the last episode folder: `episodes/day0` → `episodes/ep1`.
2. Edit `episodes/ep1/episode.json` (screens, captions, timeline, taps, vote card) and `caption.txt`.
3. Run `./make_reel.sh ep1` → `reels/ep1.mp4`
4. Run `./make_story.sh ep1` → `reels/ep1-story.png`

`reels/` is published on GitHub Pages, so the scheduler fetches the Reel straight from there.

## Files
- `composer.html`: lays out the episode's game screens, captions, style badges, intro card and vote card.
- `record.py`: plays the episode timeline in headless Chromium and captures real frames. Warns if the capture stalls.
- `music.py`: generates an original chiptune track, so Reels have royalty-free sound.
- `story.html`: the Story graphic, with room left for Instagram's poll sticker.
- `episodes/<name>/`: `episode.json` (everything the Reel shows) and `caption.txt` (the Instagram caption).

## episode.json
- `screens`: game pages to show (`src` relative to this folder), each with an optional `badge`.
- `captions`: `{id, html, top, yellow?}`; `top` is in the 360x640 layout.
- `timeline`: `[ms, action, arg]` with actions `show`/`hide` (a caption, `intro` or `outro`), `screen`, `nobadge`, `option` (reveal vote option n).
- `taps`: `{screen, fromMs, toMs, everyMs}`; taps land on the screen's `#pet` element.
- `outro`: the vote card (`big`, `sub`, `options`, `next`, `handle`).

Needs Python with Playwright (and Chromium), NumPy, FFmpeg, and `npm install` here for the Fredoka caption font.
