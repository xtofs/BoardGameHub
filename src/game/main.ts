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
roomLabel.textContent = `Room: ${room} · You: ${player}`;

const view: View = { width: canvas.width, height: canvas.height };
let mySeat: Seat | null = null;
let latest: Room | null = null;

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
  game!.render(ctx, latest.state, view);
  noticeEl.textContent = describe(game!, latest, mySeat);
}

canvas.addEventListener("click", (e) => {
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
  subscribeRoom(room, (r) => {
    latest = r;
    paint();
  });
}

void start();
