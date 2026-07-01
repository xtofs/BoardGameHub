import type { View } from "../types";
import {
    getReachableVertices,
    getSpacing,
    getTrianglePositions,
    getTriangleVertices,
    getVertices,
    normalizeState,
    triangleCenter,
    vertexToPixel,
    type TriangleChessState,
    type TriangleMove,
    type TriangleVertex,
} from "./logic";

const BOARD_FILL = "#0f172a";
const TRIANGLE_UP = "rgba(148, 163, 184, 0.14)";
const TRIANGLE_DOWN = "rgba(51, 65, 85, 0.16)";
const TRIANGLE_STROKE = "rgba(226, 232, 240, 0.08)";
const BAND_COLOR = "rgba(248, 250, 252, 0.82)";
const SELECTED_COLOR = "#f472b6";
const REACHABLE_COLOR = "#facc15";
const VERTEX_COLOR = "#94a3b8";
const PEG_COLORS = ["#ef4444", "#3b82f6"];

function sameVertex(a: TriangleVertex, b: TriangleVertex): boolean {
    return a.row === b.row && a.col === b.col;
}

function metrics(view: View) {
    const spacing = getSpacing(view);
    const triangleHeight = spacing * Math.sqrt(3) / 2;
    const offsetX = (view.width - spacing * 9) / 2;
    const offsetY = (view.height - triangleHeight * 9) / 2;

    return { spacing, triangleHeight, offsetX, offsetY };
}

export function render(
    ctx: CanvasRenderingContext2D,
    state: TriangleChessState,
    view: View,
    _seat: 0 | 1 | null,
): void {
    const normalized = normalizeState(state);

    ctx.clearRect(0, 0, view.width, view.height);
    ctx.fillStyle = BOARD_FILL;
    ctx.fillRect(0, 0, view.width, view.height);

    const { spacing, triangleHeight } = metrics(view);
    void spacing;
    void triangleHeight;

    drawTriangles(ctx, normalized, view);
    drawBands(ctx, normalized, view);
    drawPegs(ctx, normalized, view);
    drawVertices(ctx, normalized, view);
}

function drawTriangles(ctx: CanvasRenderingContext2D, state: TriangleChessState, view: View): void {
    ctx.lineWidth = 1;
    ctx.strokeStyle = TRIANGLE_STROKE;

    for (const position of getTrianglePositions()) {
        const vertices = getTriangleVertices(position);
        const points = vertices.map((vertex) => vertexToPixel(vertex, view));

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.closePath();
        ctx.fillStyle = position.index % 2 === 0 ? TRIANGLE_UP : TRIANGLE_DOWN;
        ctx.fill();
        ctx.stroke();
    }

    if (!state.selected) {
        return;
    }

    const selected = state.selected;
    const reachable = new Map(
        getReachableVertices(selected).map((vertex) => [`${vertex.row},${vertex.col}`, vertex]),
    );

    ctx.fillStyle = "rgba(250, 204, 21, 0.18)";
    for (const vertex of reachable.values()) {
        const pixel = vertexToPixel(vertex, view);
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    const selectedPixel = vertexToPixel(selected, view);
    ctx.beginPath();
    ctx.arc(selectedPixel.x, selectedPixel.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = SELECTED_COLOR;
    ctx.fill();
}

function drawBands(ctx: CanvasRenderingContext2D, state: TriangleChessState, view: View): void {
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = BAND_COLOR;

    for (const band of state.bands) {
        const from = vertexToPixel(band.from, view);
        const to = vertexToPixel(band.to, view);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }
}

function drawPegs(ctx: CanvasRenderingContext2D, state: TriangleChessState, view: View): void {
    for (const peg of state.pegs) {
        const center = triangleCenter(peg.position, view);
        ctx.beginPath();
        ctx.arc(center.x, center.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = PEG_COLORS[peg.seat];
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
        ctx.stroke();
    }
}

function drawVertices(ctx: CanvasRenderingContext2D, state: TriangleChessState, view: View): void {
    const selected = state.selected;
    const reachable = selected ? new Set(getReachableVertices(selected).map((vertex) => `${vertex.row},${vertex.col}`)) : new Set<string>();

    for (const vertex of getVertices()) {
        const pixel = vertexToPixel(vertex, view);
        const key = `${vertex.row},${vertex.col}`;
        const isSelected = selected ? sameVertex(vertex, selected) : false;
        const isReachable = reachable.has(key);

        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, isSelected ? 6.5 : isReachable ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? SELECTED_COLOR : isReachable ? REACHABLE_COLOR : VERTEX_COLOR;
        ctx.fill();
    }
}

export function hitTest(state: TriangleChessState, x: number, y: number, view: View, _seat: 0 | 1): TriangleMove | null {
    const normalized = normalizeState(state);
    const radius = getSpacing(view) * 0.22;
    let closest: TriangleVertex | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const vertex of getVertices()) {
        const pixel = vertexToPixel(vertex, view);
        const distance = Math.hypot(pixel.x - x, pixel.y - y);
        if (distance < bestDistance) {
            bestDistance = distance;
            closest = vertex;
        }
    }

    if (!closest || bestDistance > radius) {
        return null;
    }

    if (!normalized.selected) {
        return { kind: "select", vertex: closest };
    }

    if (sameVertex(closest, normalized.selected)) {
        return { kind: "select", vertex: closest };
    }

    const reachable = new Set(getReachableVertices(normalized.selected).map((vertex) => `${vertex.row},${vertex.col}`));
    if (reachable.has(`${closest.row},${closest.col}`)) {
        return { kind: "place", from: normalized.selected, to: closest };
    }

    return { kind: "select", vertex: closest };
}