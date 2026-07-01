import { describe, expect, it } from "vitest";
import {
    applyMove,
    createInitialState,
    getBoardCapacity,
    getStatus,
    getTrianglePositions,
    type TriangleChessState,
} from "./logic";

describe("triangle-chess status", () => {
    it("stays in progress before the board is full", () => {
        const state = createInitialState();
        const status = getStatus(state);
        expect(status.kind).toBe("in_progress");
    });

    it("ends with a winner when all peg slots are filled and one seat has more", () => {
        const positions = getTrianglePositions();
        const pegs = positions.map((position, index) => ({
            position,
            seat: (index % 3 === 0 ? 0 : 1) as 0 | 1,
        }));

        const state: TriangleChessState = {
            selected: null,
            bands: [],
            pegs,
        };

        const status = getStatus(state);
        expect(status.kind).toBe("win");
        if (status.kind === "win") {
            expect(status.winner).toBe(1);
        }
    });

    it("ends in draw when all peg slots are filled and both seats tie", () => {
        const positions = getTrianglePositions();
        const pegs = positions.map((position, index) => ({
            position,
            seat: (index % 2) as 0 | 1,
        }));

        const state: TriangleChessState = {
            selected: null,
            bands: [],
            pegs,
        };

        const status = getStatus(state);
        expect(status.kind).toBe("draw");
    });

    it("rejects additional moves after game end", () => {
        const fullState: TriangleChessState = {
            selected: null,
            bands: [],
            pegs: getTrianglePositions().map((position, index) => ({
                position,
                seat: (index % 2) as 0 | 1,
            })),
        };

        const next = applyMove(fullState, { kind: "select", vertex: { row: 3, col: 1 } }, 0);
        expect(next).toEqual(fullState);
    });
});

describe("triangle-chess board geometry", () => {
    it("has a stable board capacity for size-9 clipped hex board", () => {
        expect(getBoardCapacity()).toBe(getTrianglePositions().length);
        expect(getBoardCapacity()).toBeGreaterThan(0);
    });
});
