// The seat a player occupies in a room. Seat 0 moves first.
export type Seat = 0 | 1;

// Geometry handed to render/hitTest so games can scale to the canvas.
export interface View {
  width: number;
  height: number;
}

export type GameStatus =
  | { kind: "in_progress"; turn: Seat }
  | { kind: "win"; winner: Seat }
  | { kind: "draw" };

// A self-contained game definition. The shared lobby/room/sync machinery is
// generic over the state type `S` and move type `M`, so adding a game means
// implementing this interface and registering it — nothing else changes.
//
// Requirements:
//   - `S` must be plain JSON (it round-trips through Firebase).
//   - `applyMove` and `getStatus` must be PURE and deterministic; they run on
//     both clients and inside a Firebase transaction.
export interface Game<S = unknown, M = unknown> {
  readonly id: string;
  readonly name: string;

  createInitialState(): S;

  // Draw the current state from the perspective of `seat`.
  // `seat` is null for spectators.
  render(ctx: CanvasRenderingContext2D, state: S, view: View, seat: Seat | null): void;

  // Translate a canvas click into a move, or null if the click is not a legal
  // move for `seat` given `state`.
  hitTest(state: S, x: number, y: number, view: View, seat: Seat): M | null;

  // Pure reducer: return the next state after `seat` plays `move`.
  applyMove(state: S, move: M, seat: Seat): S;

  getStatus(state: S): GameStatus;
}
