import type { Game } from "../types";
import {
  createInitialState,
  applyMove,
  getStatus,
  isLegal,
  type BsgState,
  type BsgMove,
} from "./logic";
import { render, hitTest } from "./render";

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
};
