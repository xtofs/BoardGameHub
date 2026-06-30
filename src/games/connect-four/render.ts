import type { View } from "../types";
import { COLS, ROWS, type C4State, type C4Move } from "./logic";

const BOARD_COLOR = "#1d4ed8";
const HOLE_COLOR = "#0f172a";
const DISC_COLORS = ["#ef4444", "#facc15"]; // seat 0 = red, seat 1 = yellow

// Geometry derived from the canvas size so the board scales cleanly.
function metrics(view: View) {
  const cellSize = Math.min(view.width / COLS, view.height / ROWS);
  const boardW = cellSize * COLS;
  const boardH = cellSize * ROWS;
  const offsetX = (view.width - boardW) / 2;
  const offsetY = (view.height - boardH) / 2;
  return { cellSize, boardW, boardH, offsetX, offsetY };
}

export function render(ctx: CanvasRenderingContext2D, state: C4State, view: View): void {
  ctx.clearRect(0, 0, view.width, view.height);
  const { cellSize, boardW, boardH, offsetX, offsetY } = metrics(view);

  ctx.fillStyle = BOARD_COLOR;
  roundRect(ctx, offsetX, offsetY, boardW, boardH, cellSize * 0.12);
  ctx.fill();

  const radius = cellSize * 0.38;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = offsetX + col * cellSize + cellSize / 2;
      const cy = offsetY + row * cellSize + cellSize / 2;
      const v = state.board[row * COLS + col];
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = v === 0 ? HOLE_COLOR : DISC_COLORS[v - 1];
      ctx.fill();
    }
  }
}

// Map a canvas click to a column (the move), or null if outside the board.
export function hitTest(x: number, y: number, view: View): C4Move | null {
  const { cellSize, boardW, boardH, offsetX, offsetY } = metrics(view);
  if (x < offsetX || x > offsetX + boardW || y < offsetY || y > offsetY + boardH) {
    return null;
  }
  const col = Math.floor((x - offsetX) / cellSize);
  if (col < 0 || col >= COLS) return null;
  return col;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
