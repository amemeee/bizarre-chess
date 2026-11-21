# Bizarre Chess

Play chess against anime-style characters (Mio, Ren, Yuki) who react to your moves and unleash **ultimate skills** with full-screen cut-ins.

Single static page, no build step. Run it with any local server, e.g. `npx serve`.

## Characters
| Character | Difficulty | Ultimate |
|---|---|---|
| Mio | Easy | Flame Burst: burns one of your pieces |
| Ren | Hard | Time Skip: you lose your next turn |
| Yuki | Medium | Blizzard: shatters two of your pawns |

Custom portraits: add `assets/chess/<id>-<mood>.webp` (moods: idle, happy, angry, sad, shock, ult).

## Built with
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause): rules and move validation
- [stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3): chess engine, run in a Web Worker
