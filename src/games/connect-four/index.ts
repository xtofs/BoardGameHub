import type { Game } from "../types";
import {
  createInitialState,
  applyMove,
  getStatus,
  isLegal,
  COLS,
  ROWS,
  type C4State,
  type C4Move,
} from "./logic";
import { render, hitTest } from "./render";

function getGameSummary(state: C4State) {
  const discs = state.board.reduce<number>((sum, value) => (value !== 0 ? sum + 1 : sum), 0);
  return {
    movesMade: discs,
    movesTotal: COLS * ROWS,
    gameProgress: `discs: ${discs}/${COLS * ROWS}`,
  };
}

// Assemble the components into a Game the shared machinery can drive.
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
  getGameSummary,
};
