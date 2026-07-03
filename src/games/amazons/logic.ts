import type { GameStatus, GameSummary, Seat } from "../types";

export const SIZE = 10;
export const BLOCKED = 3;

// Board cells: 0 empty, 1 seat0 amazon, 2 seat1 amazon, 3 blocked (arrow).
// Row-major from the top row down: index = row * SIZE + col.
export interface AmazonsState {
  board: number[];
  turn: Seat;
}

export interface AmazonsMove {
  from: number;
  to: number;
  shot: number;
}

export const cellOf = (seat: Seat): number => seat + 1;

const START: Record<Seat, Array<[number, number]>> = {
  0: [
    [6, 0],
    [9, 3],
    [9, 6],
    [6, 9],
  ],
  1: [
    [0, 3],
    [0, 6],
    [3, 0],
    [3, 9],
  ],
};

export function createInitialState(): AmazonsState {
  const board = new Array(SIZE * SIZE).fill(0);
  for (const [row, col] of START[0]) board[row * SIZE + col] = cellOf(0);
  for (const [row, col] of START[1]) board[row * SIZE + col] = cellOf(1);
  return { board, turn: 0 };
}

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// Empty cells reachable by a queen move from `from`, stopping at the first
// occupied/blocked cell in each direction. Used both to validate a move
// destination and, on the post-move board, an arrow-shot target.
export function queenReachable(board: number[], from: number): number[] {
  const row0 = Math.floor(from / SIZE);
  const col0 = from % SIZE;
  const cells: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    let row = row0 + dr;
    let col = col0 + dc;
    while (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
      const idx = row * SIZE + col;
      if (board[idx] !== 0) break;
      cells.push(idx);
      row += dr;
      col += dc;
    }
  }
  return cells;
}

export function applyMove(state: AmazonsState, move: AmazonsMove, seat: Seat): AmazonsState {
  const { board } = state;
  if (board[move.from] !== cellOf(seat)) return state;
  if (!queenReachable(board, move.from).includes(move.to)) return state;

  const after = board.slice();
  after[move.from] = 0;
  after[move.to] = cellOf(seat);
  if (!queenReachable(after, move.to).includes(move.shot)) return state;

  after[move.shot] = BLOCKED;
  return { board: after, turn: seat === 0 ? 1 : 0 };
}

function hasAnyMove(board: number[], seat: Seat): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === cellOf(seat) && queenReachable(board, i).length > 0) return true;
  }
  return false;
}

export function getStatus(state: AmazonsState): GameStatus {
  if (!hasAnyMove(state.board, state.turn)) {
    return { kind: "win", winner: state.turn === 0 ? 1 : 0 };
  }
  return { kind: "in_progress", turn: state.turn };
}

export function getGameSummary(state: AmazonsState): GameSummary {
  const shots = state.board.reduce<number>((n, v) => (v === BLOCKED ? n + 1 : n), 0);
  return {
    movesMade: shots,
    gameProgress: `arrows shot: ${shots}`,
  };
}
