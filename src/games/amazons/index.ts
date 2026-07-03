import type { Game } from "../types";
import {
  createInitialState,
  applyMove,
  getStatus,
  getGameSummary,
  queenReachable,
  cellOf,
  type AmazonsState,
  type AmazonsMove,
} from "./logic";
import { draw, cellAt, type Selection } from "./render";

// Local-only, per-tab interactive selection for the select -> move ->
// shoot turn sequence. Never synced to Firebase — only the final atomic
// { from, to, shot } move is submitted. Each browser tab loads its own
// module instance, so module-level state here is safe.
let selection: Selection = { from: null, to: null };

function resetSelection(): void {
  selection = { from: null, to: null };
}

export const amazonsGame: Game<AmazonsState, AmazonsMove> = {
  id: "amazons",
  name: "Amazons",
  createInitialState,
  render(ctx, state, view) {
    draw(ctx, state, view, selection);
  },
  hitTest(state, x, y, view, seat) {
    const pos = cellAt(x, y, view);
    if (pos === null) return null;

    if (selection.from === null) {
      if (state.board[pos] === cellOf(seat)) selection = { from: pos, to: null };
      return null;
    }

    if (selection.to === null) {
      if (pos === selection.from) {
        resetSelection();
        return null;
      }
      if (queenReachable(state.board, selection.from).includes(pos)) {
        selection = { from: selection.from, to: pos };
      }
      return null;
    }

    if (pos === selection.to) {
      selection = { from: selection.from, to: null };
      return null;
    }

    const after = state.board.slice();
    after[selection.from] = 0;
    after[selection.to] = cellOf(seat);
    if (queenReachable(after, selection.to).includes(pos)) {
      const move: AmazonsMove = { from: selection.from, to: selection.to, shot: pos };
      resetSelection();
      return move;
    }
    return null;
  },
  applyMove,
  getStatus,
  getGameSummary,
};
