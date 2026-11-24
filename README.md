# Bizarre Chess

Play chess against anime-style characters (Mio, Ren, Yuki) who react to your moves and unleash **ultimate skills** with full-screen cut-ins. Built with Vue 3 + Vite, with player data (auth + game history) stored in Supabase.

## Run it
```
npm install
cp .env.example .env     # add your Supabase URL + anon key (optional)
npm run dev
```
Without Supabase keys the game works fine; it just doesn't save anything.

## Supabase setup
1. Create a project at supabase.com.
2. Run [supabase/schema.sql](supabase/schema.sql) in the SQL editor (tables `profiles` and `games`, row-level security, auto-profile trigger).
3. Authentication → enable the Email provider and **Allow anonymous sign-ins** (for "Continue as guest").
4. Put the project URL and anon key in `.env`.

Each finished game saves `character_id`, `result`, `moves` and `ultimates_faced`; the Profile page shows totals, per-character records and recent games.

## Characters
| Character | Difficulty | Ultimate |
|---|---|---|
| Mio | Easy | Flame Burst: burns one of your pieces |
| Ren | Hard | Time Skip: you lose your next turn |
| Yuki | Medium | Blizzard: shatters two of your pawns |

Custom portraits: add `public/assets/characters/<name>/<id>-<mood>.webp` (moods: idle, happy, angry, sad, shock, ult). Emoji are the fallback.

## Built with
- [Vue 3](https://vuejs.org), [Vite](https://vitejs.dev), [Supabase](https://supabase.com)
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause): rules and move validation
- [stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3): chess engine, run in a Web Worker
