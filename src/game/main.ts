import "../styles.css";
import { getGame } from "../games/registry";
import { isFirebaseConfigured } from "../firebase/app";
import { joinRoom, subscribeRoom, submitMove, type Room } from "../firebase/room";
import type { Game, Seat, View } from "../games/types";

const titleEl = document.getElementById("game-title") as HTMLHeadingElement;
const roomLabel = document.getElementById("room-label") as HTMLSpanElement;
const noticeEl = document.getElementById("notice") as HTMLDivElement;
const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const params = new URLSearchParams(window.location.search);
const gameId = params.get("game");
const room = params.get("room")?.trim() ?? "";
const player = params.get("player")?.trim() ?? "";

const game = getGame(gameId);

function fatal(message: string): never {
  noticeEl.textContent = message;
  throw new Error(message);
}

if (!game) fatal(`Unknown game "${gameId}". Go back to the lobby and pick one.`);
if (!room || !player) fatal("Missing room or player name. Go back to the lobby.");
if (!isFirebaseConfigured()) {
  fatal("Firebase is not configured. Fill in src/firebase/config.ts.");
}

titleEl.textContent = game.name;
roomLabel.textContent = `Room: ${room}`;

const view: View = { width: canvas.width, height: canvas.height };
let mySeat: Seat | null = null;
let latest: Room | null = null;
let notificationPermissionRequested = false;

function supportsNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

async function ensureNotificationPermissionFromGesture(): Promise<void> {
  if (!supportsNotifications()) return;
  if (Notification.permission !== "default") return;
  if (notificationPermissionRequested) return;
  notificationPermissionRequested = true;
  try {
    await Notification.requestPermission();
  } catch {
    // Ignore permission API failures; gameplay should continue normally.
  }
}

function maybeNotifyOpponentMove(previous: Room | null, next: Room): void {
  if (mySeat === null) return;
  if (!supportsNotifications() || Notification.permission !== "granted") return;

  // Avoid in-page duplicates when the player is actively looking at the board.
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  const previousMoves = typeof previous?.moveCount === "number" ? previous.moveCount : 0;
  const nextMoves = typeof next.moveCount === "number" ? next.moveCount : 0;
  if (nextMoves <= previousMoves) return;

  const previousStatus = previous ? game!.getStatus(previous.state) : null;
  if (!previousStatus || previousStatus.kind !== "in_progress") return;
  if (previousStatus.turn === mySeat) return;

  const status = game!.getStatus(next.state);
  const opponent = opponentName(game!, next, mySeat);
  const body = status.kind === "in_progress" && status.turn === mySeat
    ? "Your turn now."
    : "The game was updated.";

  new Notification(`${opponent} made a move`, {
    body,
    tag: `room-${room}`,
  });
}

function opponentName(g: Game, r: Room, seat: Seat): string {
  void g;
  return r.seats[(1 - seat) as Seat] ?? "opponent";
}

function describe(g: Game, r: Room, seat: Seat | null): string {
  const status = g.getStatus(r.state);
  if (status.kind === "win") {
    if (seat === null) return `${r.seats[status.winner] ?? "Player"} wins!`;
    return status.winner === seat ? "You win! 🎉" : "You lose.";
  }
  if (status.kind === "draw") return "Draw — board is full.";

  // in progress
  const bothPresent = r.seats[0] && r.seats[1];
  if (!bothPresent) return "Waiting for an opponent to join…";
  if (seat === null) return `${r.seats[status.turn] ?? "Player"}'s turn (spectating).`;
  return status.turn === seat
    ? "Your turn."
    : `${opponentName(g, r, seat)}'s turn.`;
}

function paint(): void {
  if (!latest) return;
  if (latest.game !== game!.id) {
    noticeEl.textContent = `This room is running "${latest.game}", not "${game!.id}".`;
    return;
  }
  game!.render(ctx, latest.state, view, mySeat);
  noticeEl.textContent = describe(game!, latest, mySeat);
}

canvas.addEventListener("click", (e) => {
  void ensureNotificationPermissionFromGesture();

  if (!latest || mySeat === null) return;
  const status = game!.getStatus(latest.state);
  if (status.kind !== "in_progress" || status.turn !== mySeat) return;

  // Translate viewport coords -> canvas coords (canvas is CSS-scaled).
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

  const move = game!.hitTest(latest.state, x, y, view, mySeat);
  if (move === null) return;
  void submitMove(room, game!, mySeat, move);
});

async function start(): Promise<void> {
  const { seat } = await joinRoom(room, game!, player);
  mySeat = seat;

  if (seat !== null) {
    void ensureNotificationPermissionFromGesture();
  }

  subscribeRoom(room, (r) => {
    if (r && r.game !== game!.id) {
      latest = null;
      noticeEl.textContent = `Room "${room}" is for "${r.game}". Open the matching game or use a new room name.`;
      return;
    }

    if (r) {
      maybeNotifyOpponentMove(latest, r);
    }

    latest = r;
    paint();
  });
}

void start();
