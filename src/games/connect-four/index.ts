import type { Game } from "../types";
import {
  createInitialState,
  applyMove,
  getStatus,
  isLegal,
  type C4State,
  type C4Move,
} from "./logic";
import { render, hitTest } from "./render";

// Assemble the pieces into a Game the shared machinery can drive.
export const connectFour: Game<C4State, C4Move> = {
  id: "connect-four",
  name: "Connect Four",
  createInitialState,
  render,
  hitTest(state, x, y, view) {
    const col = hitTest(x, y, view);
    if (col === null || !isLegal(state, col)) return null;
    return col;
  },
  applyMove,
  getStatus,
};
