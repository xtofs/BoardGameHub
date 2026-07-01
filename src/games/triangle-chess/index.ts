import type { Game } from "../types";
import { createInitialState, applyMove, getStatus, type TriangleChessState, type TriangleMove } from "./logic";
import { render, hitTest } from "./render";

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
};