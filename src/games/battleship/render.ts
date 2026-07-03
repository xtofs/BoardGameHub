import type { Seat, View } from "../types";
import {
  CELL_SHIP,
  CELL_TRIED,
  COLS,
  ROWS,
  type BsgMove,
  type BsgState,
} from "./logic";

const BG_COLOR = "#0b1020";
const BOARD_COLOR = "#173b7a";
const WATER = "#0f172a";
const SHIP = "#94a3b8";
const MISS = "#93c5fd";
const HIT = "#ef4444";
const LABEL = "#e2e8f0";
const SHIP_HOLE = "#334155";

type Side = "left" | "right";

function asGrid(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return new Array(COLS * ROWS).fill(0);
  }
  const out = new Array(COLS * ROWS).fill(0);
  for (let i = 0; i < Math.min(value.length, out.length); i++) {
    const v = Number(value[i]);
    out[i] = Number.isFinite(v) ? (v | 0) : 0;
  }
  return out;
}

function normalizeState(state: BsgState): BsgState {
  const raw = state as unknown as { boards?: unknown[]; phase?: unknown; ready?: unknown[] };
  const g0 = asGrid(raw?.boards?.[0]);
  const g1 = asGrid(raw?.boards?.[1]);
  const phase = raw?.phase === "setup" ? "setup" : "battle";
  const ready0 = Boolean(raw?.ready?.[0]);
  const ready1 = Boolean(raw?.ready?.[1]);
  return { phase, boards: [g0, g1], ready: [ready0, ready1] };
}

function metrics(view: View) {
  const outerPad = 16;
  const gap = 22;
  const labelH = 20;

  const cellByWidth = (view.width - outerPad * 2 - gap) / (COLS * 2);
  const cellByHeight = (view.height - outerPad * 2 - labelH) / ROWS;
  const cellSize = Math.max(8, Math.floor(Math.min(cellByWidth, cellByHeight)));

  const boardW = cellSize * COLS;
  const boardH = cellSize * ROWS;
  const totalW = boardW * 2 + gap;
  const leftX = Math.floor((view.width - totalW) / 2);
  const rightX = leftX + boardW + gap;
  const boardY = Math.floor((view.height - (boardH + labelH)) / 2) + labelH;

  return { cellSize, boardW, boardH, leftX, rightX, boardY, labelH };
}

function boardRect(view: View, side: Side) {
  const m = metrics(view);
  return {
    cellSize: m.cellSize,
    x: side === "left" ? m.leftX : m.rightX,
    y: m.boardY,
    w: m.boardW,
    h: m.boardH,
  };
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = LABEL;
  ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  grid: number[],
  rect: { x: number; y: number; w: number; h: number; cellSize: number },
  showShips: boolean,
): void {
  const markerRadius = rect.cellSize * 0.35

  ctx.fillStyle = BOARD_COLOR;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.cellSize * 0.12);
  ctx.fill();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ix = row * COLS + col;
      const v = grid[ix];
      const tried = (v & CELL_TRIED) !== 0;
      const ship = (v & CELL_SHIP) !== 0;

      const left = Math.round(rect.x + col * rect.cellSize);
      const right = Math.round(rect.x + (col + 1) * rect.cellSize);
      const top = Math.round(rect.y + row * rect.cellSize);
      const bottom = Math.round(rect.y + (row + 1) * rect.cellSize);
      const cellW = Math.max(1, right - left);
      const cellH = Math.max(1, bottom - top);
      const cx = left + cellW / 2;
      const cy = top + cellH / 2;
      const inset = 1;
      const innerW = Math.max(1, cellW - inset * 2);
      const innerH = Math.max(1, cellH - inset * 2);

      // Base water square in every cell, inset to leave a consistent grid gap.
      ctx.fillStyle = WATER;
      ctx.fillRect(left + inset, top + inset, innerW, innerH);

      // Own ships are visible as a light square, including when hit.
      if (ship && showShips) {
        ctx.fillStyle = SHIP;
        ctx.fillRect(left + inset, top + inset, innerW, innerH);
      }

      // Only visible own ships get the "square with hole" marker.
      if (ship && showShips && !tried) {
        ctx.beginPath();
        ctx.arc(cx, cy, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = SHIP_HOLE;
        ctx.fill();
      }

      // Shots are circles, not full-cell fills.
      if (tried) {
        ctx.beginPath();
        ctx.arc(cx, cy, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = ship ? HIT : MISS;
        ctx.fill();
      }
    }
  }

}

export function render(
  ctx: CanvasRenderingContext2D,
  state: BsgState,
  view: View,
  seat: Seat | null,
): void {
  const normalized = normalizeState(state);

  ctx.clearRect(0, 0, view.width, view.height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, view.width, view.height);

  const m = metrics(view);
  const leftRect = boardRect(view, "left");
  const rightRect = boardRect(view, "right");

  const leftLabel = seat === null ? "Seat 0" : seat === 0 ? "My ships" : "Opponent";
  const rightLabel = seat === null ? "Seat 1" : seat === 1 ? "My ships" : "Opponent";

  drawLabel(ctx, leftLabel, m.leftX + m.boardW / 2, m.boardY - 6);
  drawLabel(ctx, rightLabel, m.rightX + m.boardW / 2, m.boardY - 6);

  drawBoard(ctx, normalized.boards[0], leftRect, seat === 0);
  drawBoard(ctx, normalized.boards[1], rightRect, seat === 1);
}

// Map a canvas click to a move on the opponent board, or null if outside.
export function hitTest(x: number, y: number, view: View, seat: Seat): BsgMove | null {
  const targetSide: Side = seat === 0 ? "right" : "left";
  const rect = boardRect(view, targetSide);

  if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) {
    return null;
  }

  const row = Math.floor((y - rect.y) / rect.cellSize);
  const col = Math.floor((x - rect.x) / rect.cellSize);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return null;
  }
  return [row, col];
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
