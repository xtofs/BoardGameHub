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

function getGameSummary(state: TriangleChessState) {
    const normalized = normalizeState(state);
    const moves = normalized.bands.length;
    const pegs = normalized.pegs.length;
    const capacity = getBoardCapacity();
    return {
        movesMade: moves,
        gameProgress: `pegs: ${pegs}/${capacity}`,
    };
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
    getGameSummary,
};