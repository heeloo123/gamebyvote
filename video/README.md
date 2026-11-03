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
- `voice.py`: voiceover (Kokoro text-to-speech, open weights, run locally; model downloaded once into `tts/`) and sound effects such as Kelvin's calculator beep. Needs `pip install kokoro-onnx soundfile`.
- `story.html`: the Story graphic, with room left for Instagram's poll sticker.
- `episodes/<name>/`: `episode.json` (everything the Reel shows) and `caption.txt` (the Instagram caption).

## episode.json
- `screens`: game pages to show (`src` relative to this folder), each with an optional `badge`.
- `captions`: `{id, html, top, yellow?}`; `top` is in the 360x640 layout.
- `timeline`: `[ms, action, arg]` with actions `show`/`hide` (a caption, `intro` or `outro`), `screen`, `nobadge`, `option` (reveal vote option n), `cue` (`"screen:beat"`, tells a scripted scene such as `scenes/ep1.html` to play that beat).
- `taps`: `{screen, fromMs, toMs, everyMs}`; taps land on the screen's `#pet` element.
- `hook`: optional opening card (`big`, `sub`, `options`), shown from the very first frame with the choices already on screen. Prefer it to `intro`: a text-only first 3 seconds lost 80% of viewers on Day 0.
- `voice`: optional voiceover lines `{t, text, voice?, speed?}` (seconds; default voice `am_michael` = Mochi; Kelvin uses `bm_george` at speed 0.85). `sfx`: `{t, sound}` (`beepclick`). The music ducks under the voice.
- `outro`: the vote card (`big`, `sub`, `options`, `next`, `handle`). An option can carry `reward` and `cost` (one short line each, shown in green and red under its label, also on the Story) or a free-text `result`. Timeline `option` n spotlights option n (the others dim); `option` -1 shows them all side by side. Without `handle` the follow pill is left out.

Needs Python with Playwright (and Chromium), NumPy, FFmpeg, and `npm install` here for the Fredoka caption font.
