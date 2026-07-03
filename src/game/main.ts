import "../styles.css";
import { getGame } from "../games/registry";
import { isFirebaseConfigured } from "../firebase/app";
import { joinRoom, subscribeRoom, submitMove, submitSetup, type Room } from "../firebase/room";
import type { Game, Seat, View } from "../games/types";
import {
  CELL_SHIP,
  COLS as BSG_COLS,
  ROWS as BSG_ROWS,
  SHIP_LENGTHS,
  createGridFromPlacements,
  normalizeState as normalizeBattleshipState,
  type ShipPlacement,
} from "../games/battleship/logic";

const titleEl = document.getElementById("game-title") as HTMLHeadingElement;
const roomLabel = document.getElementById("room-label") as HTMLSpanElement;
const noticeEl = document.getElementById("notice") as HTMLDivElement;
const canvas = document.getElementById("board") as HTMLCanvasElement;
const setupControlsEl = document.getElementById("setup-controls") as HTMLDivElement | null;
const setupRotateBtn = document.getElementById("setup-rotate") as HTMLButtonElement | null;
const setupResetBtn = document.getElementById("setup-reset") as HTMLButtonElement | null;
const setupReadyBtn = document.getElementById("setup-ready") as HTMLButtonElement | null;
const ctx = canvas.getContext("2d")!;
const initialCanvasWidth = canvas.width;
const initialCanvasHeight = canvas.height;

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

const view: View = { width: initialCanvasWidth, height: initialCanvasHeight };
let mySeat: Seat | null = null;
let latest: Room | null = null;
let notificationPermissionRequested = false;
let firstRoomSnapshotReceived = false;
let roomWatchdog: number | null = null;
let localBattleshipHover: [number, number] | null = null;

const localBattleshipSetup: { placements: ShipPlacement[]; horizontal: boolean } = {
  placements: [],
  horizontal: true,
};

type SetupGame = Game & {
  commitSetup: NonNullable<Game["commitSetup"]>;
  isInSetup: NonNullable<Game["isInSetup"]>;
  isPlayerReady: NonNullable<Game["isPlayerReady"]>;
  createSetupPayload: NonNullable<Game["createSetupPayload"]>;
};

function asSetupGame(candidate: Game): SetupGame | null {
  if (!candidate.commitSetup) return null;
  if (!candidate.isInSetup) return null;
  if (!candidate.isPlayerReady) return null;
  if (!candidate.createSetupPayload) return null;
  return candidate as SetupGame;
}

function syncCanvasResolution(): void {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || initialCanvasWidth));
  const fallbackHeight = Math.round((cssWidth * initialCanvasHeight) / initialCanvasWidth);
  const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || fallbackHeight));

  view.width = cssWidth;
  view.height = cssHeight;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function isBattleshipGame(candidate: Game): boolean {
  return candidate.id === "battleship";
}

function resetLocalBattleshipSetup(): void {
  localBattleshipSetup.placements = [];
  localBattleshipSetup.horizontal = true;
}

function nextShipLength(): number | null {
  const length = SHIP_LENGTHS[localBattleshipSetup.placements.length];
  return typeof length === "number" ? length : null;
}

function placementCells(placement: ShipPlacement): number[] {
  const cells: number[] = [];
  for (let i = 0; i < placement.length; i++) {
    const row = placement.row + (placement.horizontal ? 0 : i);
    const col = placement.col + (placement.horizontal ? i : 0);
    cells.push(row * BSG_COLS + col);
  }
  return cells;
}

function canAddLocalPlacement(candidate: ShipPlacement): boolean {
  if (candidate.row < 0 || candidate.col < 0 || candidate.row >= BSG_ROWS || candidate.col >= BSG_COLS) {
    return false;
  }

  const endRow = candidate.row + (candidate.horizontal ? 0 : candidate.length - 1);
  const endCol = candidate.col + (candidate.horizontal ? candidate.length - 1 : 0);
  if (endRow >= BSG_ROWS || endCol >= BSG_COLS) {
    return false;
  }

  const occupied = new Set<number>();
  for (const placement of localBattleshipSetup.placements) {
    for (const cell of placementCells(placement)) {
      occupied.add(cell);
    }
  }

  for (const cell of placementCells(candidate)) {
    if (occupied.has(cell)) {
      return false;
    }
  }

  return true;
}

function localBattleshipPreviewGrid(): number[] {
  const grid = new Array(BSG_COLS * BSG_ROWS).fill(0);
  for (const placement of localBattleshipSetup.placements) {
    for (const cell of placementCells(placement)) {
      grid[cell] = grid[cell] | CELL_SHIP;
    }
  }
  return grid;
}

function canSubmitBattleshipSetup(): boolean {
  return createGridFromPlacements(localBattleshipSetup.placements) !== null;
}

function battleshipBoardGeometry(view: View, seat: Seat): {
  x: number;
  y: number;
  cellSize: number;
  boardW: number;
  boardH: number;
} {
  const outerPad = 16;
  const gap = 22;
  const labelH = 20;
  const cellByWidth = (view.width - outerPad * 2 - gap) / (BSG_COLS * 2);
  const cellByHeight = (view.height - outerPad * 2 - labelH) / BSG_ROWS;
  const cellSize = Math.max(8, Math.floor(Math.min(cellByWidth, cellByHeight)));
  const boardW = cellSize * BSG_COLS;
  const boardH = cellSize * BSG_ROWS;
  const totalW = boardW * 2 + gap;
  const leftX = Math.floor((view.width - totalW) / 2);
  const rightX = leftX + boardW + gap;
  const boardY = Math.floor((view.height - (boardH + labelH)) / 2) + labelH;

  const rectX = seat === 0 ? leftX : rightX;
  return {
    x: rectX,
    y: boardY,
    cellSize,
    boardW,
    boardH,
  };
}

function battleshipOwnBoardHitTest(x: number, y: number, view: View, seat: Seat): [number, number] | null {
  const geometry = battleshipBoardGeometry(view, seat);
  if (
    x < geometry.x
    || x > geometry.x + geometry.boardW
    || y < geometry.y
    || y > geometry.y + geometry.boardH
  ) {
    return null;
  }

  const row = Math.floor((y - geometry.y) / geometry.cellSize);
  const col = Math.floor((x - geometry.x) / geometry.cellSize);
  if (row < 0 || row >= BSG_ROWS || col < 0 || col >= BSG_COLS) {
    return null;
  }

  return [row, col];
}

function drawBattleshipHoverPreview(): void {
  if (!latest || mySeat === null || !isBattleshipGame(game!)) {
    return;
  }

  const setupGame = asSetupGame(game!);
  if (!setupGame || !setupGame.isInSetup(latest.state) || setupGame.isPlayerReady(latest.state, mySeat)) {
    return;
  }

  if (!localBattleshipHover) {
    return;
  }

  const length = nextShipLength();
  if (length === null) {
    return;
  }

  const candidate: ShipPlacement = {
    row: localBattleshipHover[0],
    col: localBattleshipHover[1],
    length,
    horizontal: localBattleshipSetup.horizontal,
  };
  const valid = canAddLocalPlacement(candidate);
  const geometry = battleshipBoardGeometry(view, mySeat);

  ctx.save();
  ctx.fillStyle = valid ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)";
  ctx.strokeStyle = valid ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)";
  ctx.lineWidth = 2;

  for (let i = 0; i < candidate.length; i++) {
    const row = candidate.row + (candidate.horizontal ? 0 : i);
    const col = candidate.col + (candidate.horizontal ? i : 0);
    const x = geometry.x + col * geometry.cellSize;
    const y = geometry.y + row * geometry.cellSize;
    const pad = Math.max(1, Math.floor(geometry.cellSize * 0.08));
    const w = geometry.cellSize - pad * 2;
    const h = geometry.cellSize - pad * 2;
    ctx.fillRect(x + pad, y + pad, w, h);
    ctx.strokeRect(x + pad, y + pad, w, h);
  }

  ctx.restore();
}

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
  const setupGame = asSetupGame(g);
  if (setupGame && setupGame.isInSetup(r.state)) {
    if (seat === null) {
      return "Players are setting up fleets.";
    }
    if (setupGame.isPlayerReady(r.state, seat)) {
      return "Setup complete on your side. Waiting for opponent.";
    }

    if (isBattleshipGame(g)) {
      const placed = localBattleshipSetup.placements.length;
      const total = SHIP_LENGTHS.length;
      const nextLength = nextShipLength();
      const orientation = localBattleshipSetup.horizontal ? "horizontal" : "vertical";
      if (nextLength !== null) {
        return `Place ship ${placed + 1}/${total} (length ${nextLength}, ${orientation}).`;
      }
      return "All ships placed. Press Ready to submit your fleet.";
    }

    return "Press Ready to submit your setup.";
  }

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

function updateSetupControls(g: Game, r: Room | null, seat: Seat | null): void {
  if (!setupControlsEl || !setupReadyBtn) {
    return;
  }

  const setupGame = asSetupGame(g);
  if (!setupGame || !r || seat === null || !setupGame.isInSetup(r.state)) {
    setupControlsEl.hidden = true;
    setupControlsEl.style.display = "none";
    if (setupRotateBtn) {
      setupRotateBtn.hidden = true;
    }
    if (setupResetBtn) {
      setupResetBtn.hidden = true;
    }
    setupReadyBtn.disabled = true;
    setupReadyBtn.textContent = "Ready";
    return;
  }

  const isBattleshipSetup = isBattleshipGame(g);
  const ready = setupGame.isPlayerReady(r.state, seat);
  setupControlsEl.hidden = false;
  setupControlsEl.style.display = "flex";

  if (setupRotateBtn) {
    setupRotateBtn.hidden = !isBattleshipSetup || ready;
  }
  if (setupResetBtn) {
    setupResetBtn.hidden = !isBattleshipSetup || ready;
  }

  if (isBattleshipSetup) {
    setupReadyBtn.disabled = ready || !canSubmitBattleshipSetup();
    setupReadyBtn.textContent = ready ? "Ready submitted" : "Ready";
  } else {
    setupReadyBtn.disabled = ready;
    setupReadyBtn.textContent = ready ? "Ready submitted" : "Ready";
  }
}

function paint(): void {
  if (!latest) return;
  if (latest.game !== game!.id) {
    noticeEl.textContent = `This room is running "${latest.game}", not "${game!.id}".`;
    return;
  }
  let renderState = latest.state;
  const setupGame = asSetupGame(game!);
  if (
    setupGame
    && mySeat !== null
    && isBattleshipGame(game!)
    && setupGame.isInSetup(latest.state)
    && !setupGame.isPlayerReady(latest.state, mySeat)
  ) {
    const normalized = normalizeBattleshipState(latest.state);
    const boards: [number[], number[]] = [[...normalized.boards[0]], [...normalized.boards[1]]];
    boards[mySeat] = localBattleshipPreviewGrid();
    renderState = {
      ...normalized,
      boards,
    };
  }

  game!.render(ctx, renderState, view, mySeat);
  drawBattleshipHoverPreview();
  updateSetupControls(game!, latest, mySeat);
  noticeEl.textContent = describe(game!, latest, mySeat);
}

if (setupRotateBtn) {
  setupRotateBtn.addEventListener("click", () => {
    localBattleshipSetup.horizontal = !localBattleshipSetup.horizontal;
    paint();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "r") {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }

  if (!latest || mySeat === null || !isBattleshipGame(game!)) {
    return;
  }

  const setupGame = asSetupGame(game!);
  if (!setupGame || !setupGame.isInSetup(latest.state) || setupGame.isPlayerReady(latest.state, mySeat)) {
    return;
  }

  localBattleshipSetup.horizontal = !localBattleshipSetup.horizontal;
  paint();
});

if (setupResetBtn) {
  setupResetBtn.addEventListener("click", () => {
    resetLocalBattleshipSetup();
    localBattleshipHover = null;
    paint();
  });
}

if (setupReadyBtn) {
  setupReadyBtn.addEventListener("click", () => {
    if (!latest || mySeat === null) {
      return;
    }

    const setupGame = asSetupGame(game!);
    if (!setupGame || !setupGame.isInSetup(latest.state)) {
      return;
    }

    if (setupGame.isPlayerReady(latest.state, mySeat)) {
      return;
    }

    let payload: unknown;
    if (isBattleshipGame(game!)) {
      if (!canSubmitBattleshipSetup()) {
        return;
      }
      payload = localBattleshipSetup.placements;
    } else {
      payload = setupGame.createSetupPayload(mySeat);
    }

    void submitSetup(room, game!, mySeat, payload);
  });
}

canvas.addEventListener("click", (e) => {
  void ensureNotificationPermissionFromGesture();

  if (!latest || mySeat === null) return;

  // Translate viewport coords -> canvas coords (canvas is CSS-scaled).
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * view.width;
  const y = ((e.clientY - rect.top) / rect.height) * view.height;

  const setupGame = asSetupGame(game!);
  if (
    setupGame
    && isBattleshipGame(game!)
    && setupGame.isInSetup(latest.state)
    && !setupGame.isPlayerReady(latest.state, mySeat)
  ) {
    const target = battleshipOwnBoardHitTest(x, y, view, mySeat);
    if (target === null) {
      return;
    }

    const length = nextShipLength();
    if (length === null) {
      return;
    }

    const candidate: ShipPlacement = {
      row: target[0],
      col: target[1],
      length,
      horizontal: localBattleshipSetup.horizontal,
    };

    if (!canAddLocalPlacement(candidate)) {
      return;
    }

    localBattleshipSetup.placements = [...localBattleshipSetup.placements, candidate];
    paint();
    return;
  }

  const status = game!.getStatus(latest.state);
  if (status.kind !== "in_progress" || status.turn !== mySeat) return;

  const move = game!.hitTest(latest.state, x, y, view, mySeat);
  if (move !== null) {
    void submitMove(room, game!, mySeat, move);
  }
  // Repaint even when no move resulted: some games (e.g. Amazons) track an
  // in-progress, unsynced click selection locally and need the highlight
  // to appear immediately.
  paint();
});

canvas.addEventListener("mousemove", (e) => {
  if (!latest || mySeat === null || !isBattleshipGame(game!)) {
    return;
  }

  const setupGame = asSetupGame(game!);
  if (!setupGame || !setupGame.isInSetup(latest.state) || setupGame.isPlayerReady(latest.state, mySeat)) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * view.width;
  const y = ((e.clientY - rect.top) / rect.height) * view.height;
  const target = battleshipOwnBoardHitTest(x, y, view, mySeat);

  const changed =
    (target === null && localBattleshipHover !== null)
    || (target !== null
      && (localBattleshipHover === null
        || target[0] !== localBattleshipHover[0]
        || target[1] !== localBattleshipHover[1]));

  if (!changed) {
    return;
  }

  localBattleshipHover = target;
  paint();
});

canvas.addEventListener("mouseleave", () => {
  if (localBattleshipHover === null) {
    return;
  }
  localBattleshipHover = null;
  paint();
});

async function start(): Promise<void> {
  try {
    syncCanvasResolution();
    noticeEl.textContent = "Joining room…";

    const { seat } = await joinRoom(room, game!, player);
    mySeat = seat;
    resetLocalBattleshipSetup();
    localBattleshipHover = null;

    noticeEl.textContent = "Connecting to live room updates…";
    roomWatchdog = window.setTimeout(() => {
      if (!firstRoomSnapshotReceived) {
        noticeEl.textContent = "No live room update received yet. Check Firebase connection/rules.";
      }
    }, 5000);

    if (seat !== null) {
      void ensureNotificationPermissionFromGesture();
    }

    subscribeRoom(
      room,
      (r) => {
        try {
          firstRoomSnapshotReceived = true;
          if (roomWatchdog !== null) {
            window.clearTimeout(roomWatchdog);
            roomWatchdog = null;
          }

          if (r && r.game !== game!.id) {
            latest = null;
            noticeEl.textContent = `Room "${room}" is for "${r.game}". Open the matching game or use a new room name.`;
            return;
          }

          if (r) {
            maybeNotifyOpponentMove(latest, r);
          }

          latest = r;
          updateSetupControls(game!, latest, mySeat);
          paint();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          noticeEl.textContent = `Room update processing failed: ${message}`;
        }
      },
      (error) => {
        if (roomWatchdog !== null) {
          window.clearTimeout(roomWatchdog);
          roomWatchdog = null;
        }
        noticeEl.textContent = `Failed to subscribe room updates: ${error.message}`;
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    noticeEl.textContent = `Failed to join room: ${message}`;
  }
}

void start();

window.addEventListener("resize", () => {
  syncCanvasResolution();
  paint();
});
