import type { View } from "../types";
import { SIZE, BLOCKED, queenReachable } from "./logic";

const BOARD_LIGHT = "#334155";
const BOARD_DARK = "#1e293b";
const BLOCKED_MARK = "rgba(148, 163, 184, 0.6)";
const PIECE_COLORS = ["#ef4444", "#facc15"];
const SELECTED_COLOR = "#f472b6";
const REACHABLE_COLOR = "rgba(250, 204, 21, 0.45)";

export interface Selection {
  from: number | null;
  to: number | null;
}

function metrics(view: View) {
  const cellSize = Math.min(view.width / SIZE, view.height / SIZE);
  const boardSize = cellSize * SIZE;
  const offsetX = (view.width - boardSize) / 2;
  const offsetY = (view.height - boardSize) / 2;
  return { cellSize, boardSize, offsetX, offsetY };
}

function cellCenter(index: number, m: ReturnType<typeof metrics>) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  return {
    x: m.offsetX + col * m.cellSize + m.cellSize / 2,
    y: m.offsetY + row * m.cellSize + m.cellSize / 2,
  };
}

// Reachable-cell highlights for the in-progress (local, unsynced) selection.
function highlightedCells(board: number[], selection: Selection): number[] {
  if (selection.from !== null && selection.to === null) {
    return queenReachable(board, selection.from);
  }
  if (selection.from !== null && selection.to !== null) {
    const after = board.slice();
    after[selection.from] = 0;
    after[selection.to] = board[selection.from];
    return queenReachable(after, selection.to);
  }
  return [];
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: { board: number[] },
  view: View,
  selection: Selection,
): void {
  ctx.clearRect(0, 0, view.width, view.height);
  const m = metrics(view);

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const x = m.offsetX + col * m.cellSize;
      const y = m.offsetY + row * m.cellSize;
      ctx.fillStyle = (row + col) % 2 === 0 ? BOARD_LIGHT : BOARD_DARK;
      ctx.fillRect(x, y, m.cellSize, m.cellSize);
    }
  }

  ctx.fillStyle = REACHABLE_COLOR;
  for (const idx of highlightedCells(state.board, selection)) {
    const { x, y } = cellCenter(idx, m);
    ctx.beginPath();
    ctx.arc(x, y, m.cellSize * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  const radius = m.cellSize * 0.36;
  for (let i = 0; i < state.board.length; i++) {
    const v = state.board[i];
    if (v === 0) continue;
    const { x, y } = cellCenter(i, m);

    if (v === BLOCKED) {
      ctx.strokeStyle = BLOCKED_MARK;
      ctx.lineWidth = Math.max(2, m.cellSize * 0.08);
      const pad = m.cellSize * 0.28;
      ctx.beginPath();
      ctx.moveTo(x - pad, y - pad);
      ctx.lineTo(x + pad, y + pad);
      ctx.moveTo(x + pad, y - pad);
      ctx.lineTo(x - pad, y + pad);
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = PIECE_COLORS[v - 1];
    ctx.fill();

    if (i === selection.from || i === selection.to) {
      ctx.lineWidth = Math.max(2, m.cellSize * 0.06);
      ctx.strokeStyle = SELECTED_COLOR;
      ctx.stroke();
    }
  }
}

// Pure coordinate -> board-index mapper (no game-state dependency).
export function cellAt(x: number, y: number, view: View): number | null {
  const m = metrics(view);
  if (x < m.offsetX || x > m.offsetX + m.boardSize || y < m.offsetY || y > m.offsetY + m.boardSize) {
    return null;
  }
  const col = Math.floor((x - m.offsetX) / m.cellSize);
  const row = Math.floor((y - m.offsetY) / m.cellSize);
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
  return row * SIZE + col;
}
