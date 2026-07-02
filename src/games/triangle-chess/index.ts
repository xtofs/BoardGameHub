import type { Game } from "../types";
import {
    createInitialState,
    applyMove,
    getStatus,
    getBoardCapacity,
    normalizeState,
    type TriangleChessState,
    type TriangleMove,
} from "./logic";
import { render, hitTest } from "./render";

function moveSummary(state: TriangleChessState): string {
    const normalized = normalizeState(state);
    const moves = normalized.bands.length;
    return `moves: ${moves} | pegs: ${normalized.pegs.length}/${getBoardCapacity()}`;
}

function statusSummary(state: TriangleChessState): string {
    const status = getStatus(state);
    if (status.kind === "in_progress") {
        return `In progress (turn: ${status.turn === 0 ? "first" : "second"})`;
    }
    if (status.kind === "draw") {
        return "Draw";
    }
    return `Finished (winner: ${status.winner === 0 ? "first" : "second"})`;
}

export const triangleChessGame: Game<TriangleChessState, TriangleMove> = {
    id: "triangle-chess",
    name: "Triangle Chess",
    createInitialState,
    render,
    hitTest(state, x, y, view, seat) {
        const move = hitTest(state, x, y, view, seat);
        return move;
    },
    applyMove,
    getStatus,
    moveSummary,
    statusSummary,
};