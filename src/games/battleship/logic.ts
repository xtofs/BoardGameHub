import type { GameStatus, Seat } from "../types";

export const COLS = 10;
export const ROWS = 10;
export const CELL_SHIP = 0b01;
export const CELL_TRIED = 0b10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2] as const;

// board state: one grid per seat stored row-major from the TOP row down: 
//    index = row * COLS + col.
// each cell is 
//    0b00 = empty,  0b01 = ship, 
//    0b10 = missed, 0b11 = hit
export type BsgState = [number[], number[]]; // seat 0's grid, seat 1's grid
// export interface BsgState {
//   grid_seat_0: number[];
//   grid_seat_1: number[];
// }

export type BsgMove = [number, number]; // row, col

function gridIndex(move: BsgMove): number {
  const [row, col] = move;
  return row * COLS + col;
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function canPlaceShip(
  grid: number[],
  row: number,
  col: number,
  length: number,
  horizontal: boolean,
): boolean {
  for (let i = 0; i < length; i++) {
    const r = row + (horizontal ? 0 : i);
    const c = col + (horizontal ? i : 0);
    const ix = r * COLS + c;
    if ((grid[ix] & CELL_SHIP) !== 0) {
      return false;
    }
  }
  return true;
}

function placeShip(
  grid: number[],
  row: number,
  col: number,
  length: number,
  horizontal: boolean,
): void {
  for (let i = 0; i < length; i++) {
    const r = row + (horizontal ? 0 : i);
    const c = col + (horizontal ? i : 0);
    const ix = r * COLS + c;
    grid[ix] = grid[ix] | CELL_SHIP;
  }
}

function createRandomGridWithShips(): number[] {
  const grid = new Array(COLS * ROWS).fill(0);

  for (const length of SHIP_LENGTHS) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 500) {
      attempts += 1;
      const horizontal = Math.random() < 0.5;
      const maxRow = horizontal ? ROWS : ROWS - length + 1;
      const maxCol = horizontal ? COLS - length + 1 : COLS;
      const row = randomInt(maxRow);
      const col = randomInt(maxCol);

      if (!canPlaceShip(grid, row, col, length, horizontal)) {
        continue;
      }

      placeShip(grid, row, col, length, horizontal);
      placed = true;
    }

    if (!placed) {
      throw new Error("failed to place ships");
    }
  }

  return grid;
}

export function createInitialState(): BsgState {
  return [createRandomGridWithShips(), createRandomGridWithShips()];
}

export function isInGrid(move: BsgMove): boolean {
  const [row, col] = move;
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export function isLegal(state: BsgState, move: BsgMove, seat: Seat): boolean {
  const ix = gridIndex(move);
  const targetSeat: Seat = (1 - seat) as Seat;
  const grid = state[targetSeat];
  return (grid[ix] & CELL_TRIED) === 0;
}

export function applyMove(state: BsgState, move: BsgMove, seat: Seat): BsgState {
  if (!isInGrid(move)) throw new Error(`illegal move ${move}`);
  const ix = gridIndex(move);
  if (!isLegal(state, move, seat)) throw new Error(`illegal move ${move}`);

  // clone
  const result: BsgState = [[...state[0]], [...state[1]]];
  const targetSeat: Seat = (1 - seat) as Seat;
  result[targetSeat][ix] = result[targetSeat][ix] | CELL_TRIED;

  return result;
}

// Count of moves already played determines whose turn it is (seat 0 first).
function plyCount(state: BsgState): number {
  const seat0 = state[0].reduce((n, v) => (((v & CELL_TRIED) !== 0) ? n + 1 : n), 0);
  const seat1 = state[1].reduce((n, v) => (((v & CELL_TRIED) !== 0) ? n + 1 : n), 0);
  return seat0 + seat1;
}

export function getStatus(state: BsgState): GameStatus {
  // Number of ships not yet hit on each seat's grid.
  const notHit0 = state[0].reduce(
    (n, v) => ((v & CELL_SHIP) !== 0 && (v & CELL_TRIED) === 0 ? n + 1 : n),
    0,
  );
  const notHit1 = state[1].reduce(
    (n, v) => ((v & CELL_SHIP) !== 0 && (v & CELL_TRIED) === 0 ? n + 1 : n),
    0,
  );

  if (notHit0 > 0 && notHit1 > 0) {
    return { kind: "in_progress", turn: (plyCount(state) % 2) as Seat };
  }
  if (notHit1 === 0 && notHit0 > 0) {
    return { kind: "win", winner: 0 };
  }
  if (notHit0 === 0 && notHit1 > 0) {
    return { kind: "win", winner: 1 };
  }

  // Fallback if both sides have no ships configured.
  return { kind: "draw" };
}
