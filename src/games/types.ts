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

export interface GameSummary {
  movesMade: number;
  movesTotal?: number;
  // Optional, game-owned text for game-specific counters.
  // Examples: "discs: 12/42", "shots fired: 37", "pegs: 20/54".
  gameProgress?: string;
}

// A self-contained game definition. The shared lobby/room/sync machinery is
// generic over the state type `S` and move type `M`, so adding a game means
// implementing this interface and registering it — nothing else changes.
//
// Requirements:
//   - `S` must be plain JSON (it round-trips through Firebase).
//   - `applyMove` and `getStatus` must be PURE and deterministic; they run on
//     both clients and inside a Firebase transaction.
export interface Game<S = unknown, M = unknown, P = unknown> {
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

  // Optional setup commit hook used by games that have a pregame setup phase
  // (for example, Battleship ship placement).
  commitSetup?(state: S, seat: Seat, setupPayload: P): S | null;

  // Optional setup state helpers for UI messaging/controls.
  isInSetup?(state: S): boolean;
  isPlayerReady?(state: S, seat: Seat): boolean;
  createSetupPayload?(seat: Seat): P;

  getStatus(state: S): GameStatus;

  // Structured summary for admin views (admin renders final text).
  getGameSummary(state: S): GameSummary;
}
