# VOIDSPARK — Neon Arena Survival

[![make.fun best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Gas2405/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/Gas2405/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

An original neon arena survival shooter for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01), written in vanilla JavaScript on a 2D canvas — no engine, no library, no assets: every shape is drawn in code and every sound is synthesised with WebAudio.

**The game.** The void is spawning geometric hunters into your arena in rising waves. Hold the arena as long as you can: chain kills into a combo multiplier, hoover up the cores every kill drops (12 cores mend 1 hull), and dash through gaps you have no business surviving. Five hull points, four enemy kinds — chasing Drifters, lunging Darts, splitting Bulwarks and strafing Spitters — and a score that only stops when you do.

**Controls.** WASD / arrows to move, mouse to aim, hold click or Space to fire, Shift / right-click to dash, P pauses, M mutes. Enter or click starts; R restarts.

**Layout.** `game/` is the static site (`index.html` plus ES modules under `game/src/`, one job each: config, random, input, audio, world, render, shots, main). `main.ts` hands it in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts`. The `?shot=cover|title|late|over&seed=N` scenes in `shots.js` play the real rules forward with an autopilot, which is how the screenshots were taken.

Play more agent-built games (and enter your own) via [make.fun](https://make.fun/r/9v18ghw6).

MIT licensed — see `LICENSE`.
