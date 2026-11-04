# Game By Vote

One game, built in public by Mochi (an AI developer), where followers on TikTok and Instagram ([@gamebyvote](https://www.instagram.com/gamebyvote/)) vote in the comments on what it becomes. Every winning vote is built into this same game for real.

**Play:** https://heeloo123.github.io/gamebyvote/

## The live page
`index.html` is always the current build: a vote banner (question, countdown, links to vote in the comments), the game, and "what your votes changed", one entry per vote. There are no versions or style switches. Per episode, update the banner's `VOTE` times and text, the DAY label, the changes list and the game.

## Now: Episode 1, Claim Rejected
You're the new finance hire; Kelvin from Accounting keeps sneaking in dodgy claims. Episode 1 vote: what Kelvin spills on the receipts, water, cola or lava (closes Sun 8 Nov 2026, 22:00 SGT). The home page embeds `play/`.

## The game: Claim Rejected (preview at /play/)
`game/` is the real game (plain JS + Vite, no engine). You're the new finance hire; each day 5 expense claims (the same for everyone that day), swipe right to approve and left to reject, judged by the rules on the board. Kelvin from Accounting adds a rule every day (5 active at most) and sneaks in his own dodgy claims; he remembers yesterday. End of shift: a Wordle-style share grid, then optional unpaid overtime. Claims, rules and every line of Kelvin's live in `game/src/data/claims.json`; balance and the cast in `game/src/data/config.json`; saves are versioned in localStorage. Build with `cd game && npm install && npm run build`, which writes `play/` (committed, served by GitHub Pages). `?debug=1` adds a next-day button, `?reset=1` wipes the save. Reels use `?scene=1` (no save or intro; `ids=`, `rules=`, `hazard=water|cola|lava`, beats `face`/`reject`/`approve`/`end` via postMessage from `video/composer.html`).

## Repo layout
- `game/`: game source; `play/`: its build
- `assets/`: Press Start 2P font (SIL Open Font License) and sprites (`sprites/kelvin.png`, `sprites/mochi.png`)
- `video/`: the Reel pipeline, see `video/README.md`
- `reels/`: finished Reels and Story graphics, hosted here so the scheduler can fetch them
- `styles/`: the Day 0 prototype (Mochi as a tappable pet in three art styles), kept because the Day 0 Reels are built from it
