import type { GameStatus, Seat } from "../types";

export const SIZE = 9;
export const HEX_EDGE_TRIANGLES = 3;
const TRIANGLE_HEIGHT_RATIO = Math.sqrt(3) / 2;
const TRUNCATION = (SIZE - HEX_EDGE_TRIANGLES) / 2;

export interface TriangleVertex {
    row: number;
    col: number;
}

export interface TrianglePosition {
    row: number;
    index: number;
}

export interface TriangleBand {
    from: TriangleVertex;
    to: TriangleVertex;
}

export interface TrianglePeg {
    position: TrianglePosition;
    seat: Seat;
}

export interface TriangleChessState {
    selected: TriangleVertex | null;
    bands: TriangleBand[];
    pegs: TrianglePeg[];
}

export type TriangleMove =
    | { kind: "select"; vertex: TriangleVertex }
    | { kind: "place"; from: TriangleVertex; to: TriangleVertex };

function sameVertex(a: TriangleVertex, b: TriangleVertex): boolean {
    return a.row === b.row && a.col === b.col;
}

function vertexKey(vertex: TriangleVertex): string {
    return `${vertex.row},${vertex.col}`;
}

function positionKey(position: TrianglePosition): string {
    return `${position.row},${position.index}`;
}

function isInsideHex(vertex: TriangleVertex): boolean {
    const axisA = vertex.row - vertex.col;
    const axisB = vertex.col;
    const axisC = SIZE - vertex.row;
    const maxAxis = SIZE - TRUNCATION;
    return axisA <= maxAxis && axisB <= maxAxis && axisC <= maxAxis;
}

function projectVertex(vertex: TriangleVertex): { x: number; y: number } {
    return {
        x: vertex.col + (SIZE - vertex.row) / 2,
        y: vertex.row * TRIANGLE_HEIGHT_RATIO,
    };
}

function buildVertices(): TriangleVertex[] {
    const result: TriangleVertex[] = [];
    for (let row = 0; row <= SIZE; row++) {
        for (let col = 0; col <= row; col++) {
            const vertex = { row, col };
            if (isInsideHex(vertex)) {
                result.push(vertex);
            }
        }
    }
    return result;
}

function buildTrianglePositions(): TrianglePosition[] {
    const result: TrianglePosition[] = [];
    for (let row = 0; row < SIZE; row++) {
        for (let index = 0; index <= 2 * row; index++) {
            const position = { row, index };
            const vertices = getTriangleVertices(position);
            if (vertices.every(isInsideHex)) {
                result.push(position);
            }
        }
    }
    return result;
}

const VALID_VERTICES = buildVertices();
const VALID_VERTEX_KEYS = new Set(VALID_VERTICES.map(vertexKey));
const VALID_TRIANGLE_POSITIONS = buildTrianglePositions();
const VALID_TRIANGLE_KEYS = new Set(VALID_TRIANGLE_POSITIONS.map(positionKey));

function uniqueValidPegs(pegs: TrianglePeg[]): TrianglePeg[] {
    const byPosition = new Map<string, TrianglePeg>();
    for (const peg of pegs) {
        if (!VALID_TRIANGLE_KEYS.has(positionKey(peg.position))) {
            continue;
        }
        byPosition.set(positionKey(peg.position), peg);
    }
    return [...byPosition.values()];
}

const VERTEX_BOUNDS = (() => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const vertex of VALID_VERTICES) {
        const projected = projectVertex(vertex);
        minX = Math.min(minX, projected.x);
        maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y);
        maxY = Math.max(maxY, projected.y);
    }

    return { minX, maxX, minY, maxY };
})();

function isTriangleVertex(value: unknown): value is TriangleVertex {
    return typeof value === "object" && value !== null
        && typeof (value as TriangleVertex).row === "number"
        && typeof (value as TriangleVertex).col === "number";
}

function isTriangleBand(value: unknown): value is TriangleBand {
    return typeof value === "object" && value !== null
        && isTriangleVertex((value as TriangleBand).from)
        && isTriangleVertex((value as TriangleBand).to)
        && isValidVertex((value as TriangleBand).from)
        && isValidVertex((value as TriangleBand).to);
}

function isTrianglePeg(value: unknown): value is TrianglePeg {
    return typeof value === "object" && value !== null
        && typeof (value as TrianglePeg).seat === "number"
        && isTrianglePosition((value as TrianglePeg).position)
        && VALID_TRIANGLE_KEYS.has(positionKey((value as TrianglePeg).position));
}

function isTrianglePosition(value: unknown): value is TrianglePosition {
    return typeof value === "object" && value !== null
        && typeof (value as TrianglePosition).row === "number"
        && typeof (value as TrianglePosition).index === "number";
}

export function normalizeState(state: unknown): TriangleChessState {
    if (typeof state !== "object" || state === null) {
        return createInitialState();
    }

    const raw = state as Partial<TriangleChessState>;
    const selected = isTriangleVertex(raw.selected) && isValidVertex(raw.selected) ? raw.selected : null;
    const bands = Array.isArray(raw.bands)
        ? raw.bands.filter((band): band is TriangleBand => {
            if (!isTriangleBand(band)) {
                return false;
            }
            try {
                const path = getBandPath(band.from, band.to);
                return path.length === 4 && path.every(isValidVertex);
            } catch {
                return false;
            }
        })
        : [];
    const pegs = Array.isArray(raw.pegs) ? raw.pegs.filter(isTrianglePeg) : [];

    return { selected, bands, pegs };
}

export function createInitialState(): TriangleChessState {
    return {
        selected: null,
        bands: [],
        pegs: [],
    };
}

export function isValidVertex(vertex: TriangleVertex): boolean {
    if (vertex.row < 0 || vertex.row > SIZE || vertex.col < 0 || vertex.col > vertex.row) {
        return false;
    }
    return VALID_VERTEX_KEYS.has(vertexKey(vertex));
}

export function getVertices(size = SIZE): TriangleVertex[] {
    if (size !== SIZE) {
        return [];
    }
    return VALID_VERTICES;
}

export function getTrianglePositions(size = SIZE): TrianglePosition[] {
    if (size !== SIZE) {
        return [];
    }
    return VALID_TRIANGLE_POSITIONS;
}

export function getBoardCapacity(): number {
    return VALID_TRIANGLE_POSITIONS.length;
}

export function getTriangleVertices(position: TrianglePosition): [TriangleVertex, TriangleVertex, TriangleVertex] {
    const { row, index } = position;
    const col = Math.floor(index / 2);

    if (index % 2 === 0) {
        return [
            { row, col },
            { row: row + 1, col },
            { row: row + 1, col: col + 1 },
        ];
    }

    return [
        { row, col: col + 1 },
        { row, col },
        { row: row + 1, col: col + 1 },
    ];
}

export function hasEdge(vertices: TriangleVertex[], first: TriangleVertex, second: TriangleVertex): boolean {
    for (let index = 0; index < 3; index++) {
        const a = vertices[index];
        const b = vertices[(index + 1) % 3];
        if ((sameVertex(a, first) && sameVertex(b, second)) || (sameVertex(a, second) && sameVertex(b, first))) {
            return true;
        }
    }
    return false;
}

export function getAdjacentVertices(vertex: TriangleVertex): TriangleVertex[] {
    const adjacent = new Map<string, TriangleVertex>();

    for (const position of getTrianglePositions()) {
        const vertices = getTriangleVertices(position);
        if (!vertices.some((candidate) => sameVertex(candidate, vertex))) {
            continue;
        }

        for (const candidate of vertices) {
            if (!sameVertex(candidate, vertex)) {
                adjacent.set(`${candidate.row},${candidate.col}`, candidate);
            }
        }
    }

    return [...adjacent.values()];
}

export function getReachableVertices(from: TriangleVertex): TriangleVertex[] {
    const reachable = new Map<string, TriangleVertex>();
    const visited = new Set<string>();
    const queue: Array<{ vertex: TriangleVertex; distance: number }> = [{ vertex: from, distance: 0 }];
    visited.add(`${from.row},${from.col}`);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.distance === 3) {
            reachable.set(`${current.vertex.row},${current.vertex.col}`, current.vertex);
            continue;
        }

        for (const adjacent of getAdjacentVertices(current.vertex)) {
            const key = `${adjacent.row},${adjacent.col}`;
            if (visited.has(key)) {
                continue;
            }
            visited.add(key);
            queue.push({ vertex: adjacent, distance: current.distance + 1 });
        }
    }

    return [...reachable.values()].sort((left, right) => (left.row - right.row) || (left.col - right.col));
}

export function getBandPath(from: TriangleVertex, to: TriangleVertex): TriangleVertex[] {
    const path = [from];

    let deltaRow: number;
    let deltaCol: number;

    if (from.row === to.row) {
        deltaRow = 0;
        deltaCol = from.col < to.col ? 1 : -1;
    } else if (from.col === to.col) {
        deltaRow = from.row < to.row ? 1 : -1;
        deltaCol = 0;
    } else if (from.row - from.col === to.row - to.col) {
        deltaRow = from.row < to.row ? 1 : -1;
        deltaCol = from.col < to.col ? 1 : -1;
    } else {
        throw new Error(`Invalid band path from ${from.row},${from.col} to ${to.row},${to.col}`);
    }

    let current = from;
    while (!sameVertex(current, to)) {
        current = { row: current.row + deltaRow, col: current.col + deltaCol };
        path.push(current);
    }

    return path;
}

export function hasBandBetween(bands: TriangleBand[], first: TriangleVertex, second: TriangleVertex): boolean {
    for (const band of bands) {
        const path = getBandPath(band.from, band.to);
        for (let index = 0; index < path.length - 1; index++) {
            const a = path[index];
            const b = path[index + 1];
            if ((sameVertex(a, first) && sameVertex(b, second)) || (sameVertex(a, second) && sameVertex(b, first))) {
                return true;
            }
        }
    }
    return false;
}

export function isTriangleSurrounded(bands: TriangleBand[], position: TrianglePosition): boolean {
    const vertices = getTriangleVertices(position);
    for (let index = 0; index < 3; index++) {
        const first = vertices[index];
        const second = vertices[(index + 1) % 3];
        if (!hasBandBetween(bands, first, second)) {
            return false;
        }
    }
    return true;
}

export function getSpacing(view: { width: number; height: number }): number {
    const padding = 28;
    const widthUnits = Math.max(1, VERTEX_BOUNDS.maxX - VERTEX_BOUNDS.minX);
    const heightUnits = Math.max(1, VERTEX_BOUNDS.maxY - VERTEX_BOUNDS.minY);
    const spacing = Math.floor(Math.min(
        (view.width - padding * 2) / widthUnits,
        (view.height - padding * 2) / heightUnits,
    ));
    return Math.max(24, spacing);
}

export function vertexToPixel(vertex: TriangleVertex, view: { width: number; height: number }): { x: number; y: number } {
    const spacing = getSpacing(view);
    const projected = projectVertex(vertex);
    const boardWidth = (VERTEX_BOUNDS.maxX - VERTEX_BOUNDS.minX) * spacing;
    const boardHeight = (VERTEX_BOUNDS.maxY - VERTEX_BOUNDS.minY) * spacing;
    const offsetX = (view.width - boardWidth) / 2 - VERTEX_BOUNDS.minX * spacing;
    const offsetY = (view.height - boardHeight) / 2 - VERTEX_BOUNDS.minY * spacing;

    return {
        x: offsetX + projected.x * spacing,
        y: offsetY + projected.y * spacing,
    };
}

export function triangleCenter(position: TrianglePosition, view: { width: number; height: number }): { x: number; y: number } {
    const vertices = getTriangleVertices(position);
    const a = vertexToPixel(vertices[0], view);
    const b = vertexToPixel(vertices[1], view);
    const c = vertexToPixel(vertices[2], view);

    return {
        x: (a.x + b.x + c.x) / 3,
        y: (a.y + b.y + c.y) / 3,
    };
}

export function getStatus(state: TriangleChessState): GameStatus {
    const normalized = normalizeState(state);
    const pegs = uniqueValidPegs(normalized.pegs);
    const capacity = getBoardCapacity();

    if (pegs.length >= capacity) {
        let seat0Score = 0;
        let seat1Score = 0;
        for (const peg of pegs) {
            if (peg.seat === 0) {
                seat0Score += 1;
            } else {
                seat1Score += 1;
            }
        }

        if (seat0Score === seat1Score) {
            return { kind: "draw" };
        }

        return {
            kind: "win",
            winner: seat0Score > seat1Score ? 0 : 1,
        };
    }

    return {
        kind: "in_progress",
        turn: (normalized.bands.length % 2) as Seat,
    };
}

export function applyMove(state: TriangleChessState, move: TriangleMove, seat: Seat): TriangleChessState {
    const current = normalizeState(state);
    void seat;

    if (getStatus(current).kind !== "in_progress") {
        return current;
    }

    if (move.kind === "select") {
        if (!isValidVertex(move.vertex)) {
            return current;
        }
        return {
            ...current,
            selected: move.vertex,
        };
    }

    if (!isValidVertex(move.from) || !isValidVertex(move.to)) {
        return current;
    }
    if (!current.selected || !sameVertex(current.selected, move.from)) {
        return current;
    }

    const path = getBandPath(move.from, move.to);
    if (path.length !== 4 || !path.every(isValidVertex)) {
        return current;
    }

    const bands = [...current.bands, { from: move.from, to: move.to }];
    const pegs = [...current.pegs];

    for (const position of getTrianglePositions()) {
        if (!isTriangleSurrounded(bands, position)) {
            continue;
        }
        if (pegs.some((peg) => peg.position.row === position.row && peg.position.index === position.index)) {
            continue;
        }
        pegs.push({ position, seat });
    }

    return {
        selected: null,
        bands,
        pegs,
    };
}