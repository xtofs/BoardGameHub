import type { Game } from "./types";
import { connectFour } from "./connect-four";

// The single place that knows about every game. The lobby lists these, and the
// game page resolves `?game=<id>` against this map.
//
// To add a game: implement it under src/games/<your-game>/ and add one line here.
export const games: Record<string, Game> = {
  [connectFour.id]: connectFour,
};

export function getGame(id: string | null): Game | undefined {
  if (!id) return undefined;
  return games[id];
}

export function listGames(): Game[] {
  return Object.values(games);
}
