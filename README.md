# Board Game Hub

A hub for turn-based, two-player board games. Two players in different browsers
play against each other, with game state synced through **Firebase Realtime
Database**. Built with **Vite + TypeScript**, served as static pages.

First game: **Connect Four**. The architecture is built so adding more games is
cheap — see [Adding a game](#adding-a-game).

## Pages

- `index.html` — lobby: pick a game, enter a room name and your name.
- `game.html?game=<id>&room=<room>&player=<name>` — the game board.

No authentication, no room listing (yet) — just share a room name with a friend.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ (deployable to GitHub Pages)
```

Open the dev URL in two browsers (or one normal + one incognito), pick the same
game and room name, and play.

## Firebase setup

The web config in `src/firebase/config.ts` is already filled in for this project.
The values are **not secret** — they ship in every static client; security comes
from your Database **rules**, not from hiding the config. To point at your own
project:

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Realtime Database → Create database** (pick a region; start in
   *test mode*).
3. **Project settings (gear) → General → Your apps → add a Web app**, then copy
   the generated `firebaseConfig` values into `src/firebase/config.ts`.
4. Set Database **rules**. Permissive dev rules (open — fine for a hobby hub,
   tighten before any real deployment):

   ```json
   {
     "rules": {
       "rooms": {
         "$room": { ".read": true, ".write": true }
       }
     }
   }
   ```

## How it works

- `rooms/{room}` in the database holds `{ game, state, status, seats }`.
- Seats are claimed by join order via a transaction; re-joining with the same
  name reclaims your seat (survives a refresh).
- Moves go through a Firebase **transaction** (`submitMove`) that re-reads the
  state, so out-of-turn and racing moves are rejected. Both browsers re-render
  on every update via an `onValue` subscription.

## Adding a game

1. Create `src/games/<your-game>/` implementing the `Game<S, M>` interface from
   `src/games/types.ts` (`createInitialState`, `render`, `hitTest`, `applyMove`,
   `getStatus`). Keep state JSON-serializable, and keep `applyMove`/`getStatus`
   pure (they run on both clients and inside the move transaction).
2. Register it with one line in `src/games/registry.ts`.

That's it — the lobby and game page pick it up automatically.

## Project layout

```
index.html / game.html      Vite entry points (MPA)
src/firebase/               config, app singletons, generic room sync
src/games/types.ts          Game interface
src/games/registry.ts       game id -> Game (add games here)
src/games/connect-four/     first game: logic, render, assembly
src/lobby/ src/game/         page controllers
```
