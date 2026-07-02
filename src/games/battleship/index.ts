import type { Game } from "../types";
import {
  commitSetup,
  createSetupPayload,
  createInitialState,
  applyMove,
  getStatus,
  isInSetup,
  isLegal,
  isPlayerReady,
  normalizeState,
  CELL_TRIED,
  type BsgState,
  type BsgMove,
  type ShipPlacement,
} from "./logic";
import { render, hitTest } from "./render";

function getGameSummary(state: BsgState) {
  const normalized = normalizeState(state);
  const shotsOnSeat0 = normalized.boards[0].reduce<number>((sum, value) => ((value & CELL_TRIED) !== 0 ? sum + 1 : sum), 0);
  const shotsOnSeat1 = normalized.boards[1].reduce<number>((sum, value) => ((value & CELL_TRIED) !== 0 ? sum + 1 : sum), 0);
  const moves = shotsOnSeat0 + shotsOnSeat1;

  if (normalized.phase === "setup") {
    const readyCount = Number(normalized.ready[0]) + Number(normalized.ready[1]);
    return {
      movesMade: moves,
      gameProgress: `setup ready: ${readyCount}/2`,
    };
  }

  return {
    movesMade: moves,
    gameProgress: `shots fired: ${moves}`,
  };
}

// Assemble the components into a Game the shared machinery can drive.
export const battleshipGame: Game<BsgState, BsgMove, ShipPlacement[]> = {
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
  commitSetup,
  isInSetup,
  isPlayerReady,
  createSetupPayload,
  getStatus,
  getGameSummary,
};
