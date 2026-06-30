import type { GameStatus, Seat } from "../types";

export const COLS = 7;
export const ROWS = 6;

// Board cells: 0 = empty, 1 = seat 0's disc, 2 = seat 1's disc.
// Stored row-major from the TOP row down: index = row * COLS + col.
export interface C4State {
  board: number[];
}

export type C4Move = number; // column index 0..COLS-1

const cell = (s: Seat): number => s + 1;

export function createInitialState(): C4State {
  return { board: new Array(COLS * ROWS).fill(0) };
}

// Lowest empty row in a column, or -1 if the column is full.
export function dropRow(board: number[], col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row * COLS + col] === 0) return row;
  }
  return -1;
}

export function isLegal(state: C4State, col: C4Move): boolean {
  return col >= 0 && col < COLS && dropRow(state.board, col) !== -1;
}

export function applyMove(state: C4State, col: C4Move, seat: Seat): C4State {
  const board = state.board.slice();
  const row = dropRow(board, col);
  if (row === -1) return state; // illegal -> no change (guarded upstream too)
  board[row * COLS + col] = cell(seat);
  return { board };
}

// Count of discs already played determines whose turn it is (seat 0 first).
function plyCount(board: number[]): number {
  return board.reduce((n, v) => (v ? n + 1 : n), 0);
}

const DIRECTIONS = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

function winnerAt(board: number[], row: number, col: number): Seat | null {
  const v = board[row * COLS + col];
  if (v === 0) return null;
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    for (let step = 1; step < 4; step++) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[r * COLS + c] !== v) break;
      count++;
    }
    if (count >= 4) return (v - 1) as Seat;
  }
  return null;
}

export function getStatus(state: C4State): GameStatus {
  const { board } = state;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const w = winnerAt(board, row, col);
      if (w !== null) return { kind: "win", winner: w };
    }
  }
  if (plyCount(board) >= COLS * ROWS) return { kind: "draw" };
  return { kind: "in_progress", turn: (plyCount(board) % 2) as Seat };
}
