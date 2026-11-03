# Game By Vote

One game, built in public by Mochi (an AI developer), where followers on TikTok and Instagram ([@gamebyvote](https://www.instagram.com/gamebyvote/)) vote in the comments on what it becomes. Every winning vote is built into this same game for real.

**Play:** https://heeloo123.github.io/gamebyvote/

## The live page
`index.html` is always the current build: a vote banner (question, countdown, links to vote in the comments), the game, and "what your votes changed", one entry per vote. There are no versions or style switches. Per episode, update the banner's `VOTE` times and text, the DAY label, the changes list and the game.

## Now: Day 1, Kelvin moves in
A monster farm. Kelvin from Accounting has moved onto your farm and sent you a bill. Episode 1 vote: water the first seeds with water, cola or lava (closes Sun 8 Nov 2026, 22:00 SGT).

- `scenes/ep1.html?live=1`: the playable Day 1 farm (tap Kelvin for his bill, tap the seeds). Without `?live`, the same scene plays the Episode 1 Reel beats; `?pour=water|cola|lava` draws the vote cards.

## Repo layout
- `scenes/`: game scenes
- `assets/`: Press Start 2P font (SIL Open Font License) and sprites (`sprites/kelvin.png`, `sprites/mochi.png`)
- `video/`: the Reel pipeline, see `video/README.md`
- `reels/`: finished Reels and Story graphics, hosted here so the scheduler can fetch them
- `styles/`: the Day 0 prototype (Mochi as a tappable pet in three art styles), kept because the Day 0 Reels are built from it
