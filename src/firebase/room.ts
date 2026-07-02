import { ref, onValue, runTransaction, type Unsubscribe } from "firebase/database";
import { db } from "./app";
import type { Game, Seat } from "../games/types";

// Shape persisted at rooms/{room}. `state` is the game-specific JSON blob;
// `status` is denormalized so the lobby/notice can read it without knowing the
// game's rules.
export interface Room {
  game: string;
  state: unknown;
  status: "in_progress" | "win" | "draw";
  winner?: Seat;
  seats: { 0?: string; 1?: string };
  createdAt?: number;
  updatedAt?: number;
  lastMoveAt?: number;
  moveCount?: number;
}

function roomRef(room: string) {
  return ref(db, `rooms/${room}`);
}

function statusFields(game: Game, state: unknown): Pick<Room, "status" | "winner"> {
  const s = game.getStatus(state);
  if (s.kind === "win") return { status: "win", winner: s.winner };
  if (s.kind === "draw") return { status: "draw" };
  return { status: "in_progress" };
}

export interface JoinResult {
  // The seat this player occupies, or null if the room is full (spectator).
  seat: Seat | null;
}

// Join (creating the room if needed) and claim a seat by join order.
// Re-joining with the same player name reclaims the same seat (survives refresh).
export async function joinRoom(
  room: string,
  game: Game,
  player: string,
): Promise<JoinResult> {
  let seat: Seat | null = null;

  await runTransaction(roomRef(room), (current: Room | null) => {
    const now = Date.now();
    const next: Room =
      current ?? {
        game: game.id,
        state: game.createInitialState(),
        status: "in_progress",
        seats: {},
        createdAt: now,
        updatedAt: now,
        moveCount: 0,
      };
    next.seats = next.seats ?? {};
    next.createdAt = next.createdAt ?? now;
    next.updatedAt = now;
    next.moveCount = typeof next.moveCount === "number" ? next.moveCount : 0;

    if (next.seats[0] === player) seat = 0;
    else if (next.seats[1] === player) seat = 1;
    else if (!next.seats[0]) {
      next.seats[0] = player;
      seat = 0;
    } else if (!next.seats[1]) {
      next.seats[1] = player;
      seat = 1;
    } else {
      seat = null; // both seats taken -> spectator
    }

    return next;
  });

  return { seat };
}

// Subscribe to live room updates. Returns an unsubscribe function.
export function subscribeRoom(
  room: string,
  cb: (room: Room | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    roomRef(room),
    (snap) => cb(snap.val() as Room | null),
    (error) => {
      onError?.(error as Error);
    },
  );
}

// Attempt a move inside a transaction. The reducer re-reads the latest state,
// so it safely rejects out-of-turn / illegal moves and resolves races.
export async function submitMove(
  room: string,
  game: Game,
  seat: Seat,
  move: unknown,
): Promise<void> {
  await runTransaction(roomRef(room), (current: Room | null) => {
    if (!current) return current; // room vanished
    if (current.status !== "in_progress") return current; // game over

    const status = game.getStatus(current.state);
    if (status.kind !== "in_progress" || status.turn !== seat) {
      return current; // not this player's turn -> no-op
    }

    const nextState = game.applyMove(current.state, move, seat);
    const changed = JSON.stringify(nextState) !== JSON.stringify(current.state);
    if (!changed) {
      return current;
    }

    const now = Date.now();
    return {
      ...current,
      state: nextState,
      updatedAt: now,
      lastMoveAt: now,
      moveCount: (typeof current.moveCount === "number" ? current.moveCount : 0) + 1,
      ...statusFields(game, nextState),
    };
  });
}

// Commit pregame setup data for games that support setup phases.
export async function submitSetup<P>(
  room: string,
  game: Game<unknown, unknown, P>,
  seat: Seat,
  setupPayload: P,
): Promise<void> {
  await runTransaction(roomRef(room), (current: Room | null) => {
    if (!current) return current;
    if (current.status !== "in_progress") return current;
    if (!game.commitSetup) return current;

    const nextState = game.commitSetup(current.state, seat, setupPayload);
    if (nextState === null) {
      return current;
    }

    const changed = JSON.stringify(nextState) !== JSON.stringify(current.state);
    if (!changed) {
      return current;
    }

    const now = Date.now();
    return {
      ...current,
      state: nextState,
      updatedAt: now,
      ...statusFields(game, nextState),
    };
  });
}
