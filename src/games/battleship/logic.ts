import type { GameStatus, Seat } from "../types";

export const COLS = 10;
export const ROWS = 10;
export const CELL_SHIP = 0b01;
export const CELL_TRIED = 0b10;
export const SHIP_LENGTHS = [5, 4, 3, 3, 2] as const;

export interface ShipPlacement {
  row: number;
  col: number;
  length: number;
  horizontal: boolean;
}

export interface BsgState {
  phase: "setup" | "battle";
  boards: [number[], number[]];
  ready: [boolean, boolean];
}

export type BsgMove = [number, number]; // row, col

function gridIndex(move: BsgMove): number {
  const [row, col] = move;
  return row * COLS + col;
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function emptyGrid(): number[] {
  return new Array(COLS * ROWS).fill(0);
}

function asGrid(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return emptyGrid();
  }

  const out = emptyGrid();
  for (let i = 0; i < Math.min(value.length, out.length); i++) {
    const v = Number(value[i]);
    out[i] = Number.isFinite(v) ? (v | 0) : 0;
  }
  return out;
}

export function normalizeState(value: unknown): BsgState {
  // Current shape.
  if (typeof value === "object" && value !== null) {
    const maybe = value as {
      phase?: unknown;
      boards?: unknown[];
      ready?: unknown[];
    };

    const boards = maybe.boards;
    if (Array.isArray(boards) && boards.length >= 2) {
      const phase = maybe.phase === "setup" ? "setup" : "battle";
      const ready0 = Boolean(maybe.ready?.[0]);
      const ready1 = Boolean(maybe.ready?.[1]);
      return {
        phase,
        boards: [asGrid(boards[0]), asGrid(boards[1])],
        ready: [ready0, ready1],
      };
    }
  }

  // Legacy shape: [grid0, grid1] -> treat as battle with both ready.
  if (Array.isArray(value) && value.length >= 2) {
    return {
      phase: "battle",
      boards: [asGrid(value[0]), asGrid(value[1])],
      ready: [true, true],
    };
  }

  // Fallback for invalid state.
  return {
    phase: "setup",
    boards: [emptyGrid(), emptyGrid()],
    ready: [false, false],
  };
}

function sameLengths(placements: ShipPlacement[]): boolean {
  if (placements.length !== SHIP_LENGTHS.length) {
    return false;
  }

  const actual = placements.map((p) => p.length).sort((a, b) => a - b);
  const expected = [...SHIP_LENGTHS].sort((a, b) => a - b);

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

function canPlaceShip(
  grid: number[],
  row: number,
  col: number,
  length: number,
  horizontal: boolean,
): boolean {
  if (row < 0 || col < 0 || row >= ROWS || col >= COLS) {
    return false;
  }

  const endRow = row + (horizontal ? 0 : length - 1);
  const endCol = col + (horizontal ? length - 1 : 0);
  if (endRow >= ROWS || endCol >= COLS) {
    return false;
  }

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

function createRandomPlacements(): ShipPlacement[] {
  const placements: ShipPlacement[] = [];
  const grid = emptyGrid();

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
      placements.push({ row, col, length, horizontal });
      placed = true;
    }

    if (!placed) {
      throw new Error("failed to place ships");
    }
  }

  return placements;
}

export function createInitialState(): BsgState {
  return {
    phase: "setup",
    boards: [emptyGrid(), emptyGrid()],
    ready: [false, false],
  };
}

function asPlacementArray(value: unknown): ShipPlacement[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const placements: ShipPlacement[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const row = Number((item as { row?: unknown }).row);
    const col = Number((item as { col?: unknown }).col);
    const length = Number((item as { length?: unknown }).length);
    const horizontal = Boolean((item as { horizontal?: unknown }).horizontal);

    if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(length)) {
      return null;
    }

    placements.push({ row, col, length, horizontal });
  }

  return placements;
}

export function createSetupPayload(): ShipPlacement[] {
  return createRandomPlacements();
}

export function createGridFromPlacements(placements: ShipPlacement[]): number[] | null {
  if (!sameLengths(placements)) {
    return null;
  }

  const grid = emptyGrid();
  for (const placement of placements) {
    if (!canPlaceShip(grid, placement.row, placement.col, placement.length, placement.horizontal)) {
      return null;
    }
    placeShip(grid, placement.row, placement.col, placement.length, placement.horizontal);
  }

  return grid;
}

export function commitSetup(
  state: BsgState,
  seat: Seat,
  setupPayload: unknown,
): BsgState | null {
  const normalizedState = normalizeState(state);

  if (normalizedState.phase !== "setup") {
    return normalizedState;
  }

  if (normalizedState.ready[seat]) {
    return normalizedState;
  }

  const placements = asPlacementArray(setupPayload);
  if (placements === null) {
    return null;
  }

  const grid = createGridFromPlacements(placements);
  if (grid === null) {
    return null;
  }

  const ready: [boolean, boolean] = [...normalizedState.ready] as [boolean, boolean];
  const boards: [number[], number[]] = [[...normalizedState.boards[0]], [...normalizedState.boards[1]]];

  boards[seat] = grid;
  ready[seat] = true;

  return {
    phase: ready[0] && ready[1] ? "battle" : "setup",
    boards,
    ready,
  };
}

export function isInSetup(state: BsgState): boolean {
  return normalizeState(state).phase === "setup";
}

export function isPlayerReady(state: BsgState, seat: Seat): boolean {
  return normalizeState(state).ready[seat];
}

export function isInGrid(move: BsgMove): boolean {
  const [row, col] = move;
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export function isLegal(state: BsgState, move: BsgMove, seat: Seat): boolean {
  const normalizedState = normalizeState(state);

  if (normalizedState.phase !== "battle") {
    return false;
  }

  const ix = gridIndex(move);
  const targetSeat: Seat = (1 - seat) as Seat;
  const grid = normalizedState.boards[targetSeat];
  return (grid[ix] & CELL_TRIED) === 0;
}

export function applyMove(state: BsgState, move: BsgMove, seat: Seat): BsgState {
  const normalizedState = normalizeState(state);

  if (normalizedState.phase !== "battle") {
    throw new Error(`illegal move ${move}`);
  }
  if (!isInGrid(move)) throw new Error(`illegal move ${move}`);
  if (!isLegal(normalizedState, move, seat)) throw new Error(`illegal move ${move}`);
  const ix = gridIndex(move);

  // clone
  const result: BsgState = {
    phase: "battle",
    ready: [...normalizedState.ready] as [boolean, boolean],
    boards: [[...normalizedState.boards[0]], [...normalizedState.boards[1]]],
  };
  const targetSeat: Seat = (1 - seat) as Seat;
  result.boards[targetSeat][ix] = result.boards[targetSeat][ix] | CELL_TRIED;

  return result;
}

// Count of moves already played determines whose turn it is (seat 0 first).
function plyCount(state: BsgState): number {
  const normalizedState = normalizeState(state);
  const seat0 = normalizedState.boards[0].reduce((n, v) => (((v & CELL_TRIED) !== 0) ? n + 1 : n), 0);
  const seat1 = normalizedState.boards[1].reduce((n, v) => (((v & CELL_TRIED) !== 0) ? n + 1 : n), 0);
  return seat0 + seat1;
}

export function getStatus(state: BsgState): GameStatus {
  const normalizedState = normalizeState(state);

  if (normalizedState.phase === "setup") {
    if (!normalizedState.ready[0]) {
      return { kind: "in_progress", turn: 0 };
    }
    if (!normalizedState.ready[1]) {
      return { kind: "in_progress", turn: 1 };
    }

    return { kind: "in_progress", turn: 0 };
  }

  // Number of ships not yet hit on each seat's grid.
  const notHit0 = normalizedState.boards[0].reduce(
    (n, v) => ((v & CELL_SHIP) !== 0 && (v & CELL_TRIED) === 0 ? n + 1 : n),
    0,
  );
  const notHit1 = normalizedState.boards[1].reduce(
    (n, v) => ((v & CELL_SHIP) !== 0 && (v & CELL_TRIED) === 0 ? n + 1 : n),
    0,
  );

  if (notHit0 > 0 && notHit1 > 0) {
    return { kind: "in_progress", turn: (plyCount(normalizedState) % 2) as Seat };
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
