import type { Game } from "../types";
import {
  createInitialState,
  applyMove,
  getStatus,
  isLegal,
  CELL_TRIED,
  type BsgState,
  type BsgMove,
} from "./logic";
import { render, hitTest } from "./render";

function getGameSummary(state: BsgState) {
  const shotsOnSeat0 = state[0].reduce<number>((sum, value) => ((value & CELL_TRIED) !== 0 ? sum + 1 : sum), 0);
  const shotsOnSeat1 = state[1].reduce<number>((sum, value) => ((value & CELL_TRIED) !== 0 ? sum + 1 : sum), 0);
  const moves = shotsOnSeat0 + shotsOnSeat1;
  return {
    movesMade: moves,
    gameProgress: `shots fired: ${moves}`,
  };
}

// Assemble the components into a Game the shared machinery can drive.
export const battleshipGame: Game<BsgState, BsgMove> = {
  id: "battleship",
  name: "Battleship",
  createInitialState,
  render,
  hitTest(state, x, y, view, seat) {
    const move = hitTest(x, y, view, seat);
    if (move === null || !isLegal(state, move, seat)) return null;
    return move;
  },
  applyMove,
  getStatus,
  getGameSummary,
};
