import "../styles.css";
import { onValue, ref, remove } from "firebase/database";
import { db, isFirebaseConfigured } from "../firebase/app";
import { getGame } from "../games/registry";
import type { Seat } from "../games/types";

type SeatMap = { 0?: string; 1?: string };
type PersistedStatus = "in_progress" | "win" | "draw";

type RoomRow = {
    game?: string;
    state?: unknown;
    status?: PersistedStatus;
    winner?: number;
    seats?: SeatMap;
    moveCount?: number;
    createdAt?: number;
    updatedAt?: number;
    lastMoveAt?: number;
};

const noticeEl = document.getElementById("admin-notice") as HTMLDivElement;
const roomListEl = document.getElementById("room-list") as HTMLUListElement;

const deleting = new Set<string>();
let latestRows: Array<[string, RoomRow]> = [];
let firstRoomsSnapshotReceived = false;
let roomsWatchdog: number | null = null;

function setNotice(msg: string): void {
    noticeEl.textContent = msg;
}

function roomTitle(name: string, room: RoomRow): string {
    const game = room.game ?? "unknown-game";
    return `${name} (${game})`;
}

function roomStatusMeta(room: RoomRow): string {
    const status = statusSummary(room);
    return `status: ${status}`;
}

function roomSeatsMeta(room: RoomRow): string {
    const s0 = room.seats?.[0] ?? "-";
    const s1 = room.seats?.[1] ?? "-";
    return `seats: first ${s0}, second ${s1}`;
}

function formatStatus(status: PersistedStatus | undefined): string {
    if (status === "in_progress") {
        return "In progress";
    }
    if (status === "win") {
        return "Finished";
    }
    if (status === "draw") {
        return "Draw";
    }
    return "Unknown";
}

function moveSummary(room: RoomRow): string {
    const game = getGame(room.game ?? null);
    if (game) {
        try {
            const summary = game.getGameSummary(room.state);
            const total = typeof summary.movesTotal === "number" ? `/${summary.movesTotal}` : "";
            const base = `moves: ${summary.movesMade}${total}`;
            return summary.gameProgress ? `${base} | ${summary.gameProgress}` : base;
        } catch {
            return "moves: unknown";
        }
    }

    const moveCount = typeof room.moveCount === "number" ? room.moveCount : 0;
    return `moves: ${moveCount}`;
}

function seatLabel(room: RoomRow, seat: Seat): string {
    return room.seats?.[seat] ?? (seat === 0 ? "first" : "second");
}

function statusSummary(room: RoomRow): string {
    const game = getGame(room.game ?? null);
    if (game) {
        try {
            const status = game.getStatus(room.state);
            if (status.kind === "in_progress") {
                return `In progress (turn: ${seatLabel(room, status.turn)})`;
            }
            if (status.kind === "draw") {
                return "Draw";
            }
            return `Finished (winner: ${seatLabel(room, status.winner)})`;
        } catch {
            return "Unknown";
        }
    }

    const fallbackStatus = formatStatus(room.status);
    if (room.status === "win" && typeof room.winner === "number") {
        return `${fallbackStatus} (winner: ${seatLabel(room, room.winner as Seat)})`;
    }
    return fallbackStatus;
}

function formatAge(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) {
        return `${totalMinutes}m`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    if (totalHours < 24) {
        return `${totalHours}h`;
    }

    const days = Math.floor(totalHours / 24);
    return `${days}d`;
}

function activitySummary(room: RoomRow): string {
    const now = Date.now();
    const basis = typeof room.lastMoveAt === "number"
        ? room.lastMoveAt
        : typeof room.updatedAt === "number"
            ? room.updatedAt
            : room.createdAt;

    if (typeof basis !== "number") {
        return "last move: unknown";
    }

    return `last move: ${formatAge(now - basis)} ago`;
}

async function deleteRoom(roomName: string): Promise<void> {
    if (deleting.has(roomName)) {
        return;
    }
    deleting.add(roomName);
    try {
        await remove(ref(db, `rooms/${roomName}`));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(`Delete failed for "${roomName}": ${msg}`);
    } finally {
        deleting.delete(roomName);
    }
}

function renderRooms(rows: Array<[string, RoomRow]>): void {
    latestRows = rows;
    roomListEl.innerHTML = "";

    if (rows.length === 0) {
        setNotice("No rooms found.");
        return;
    }

    setNotice(`${rows.length} room(s).`);

    for (const [name, room] of rows) {
        const item = document.createElement("li");
        item.className = "room-item";

        const title = document.createElement("h3");
        title.className = "room-title";
        title.textContent = roomTitle(name, room);

        const statusMeta = document.createElement("p");
        statusMeta.className = "room-meta";
        statusMeta.textContent = roomStatusMeta(room);

        const seatsMeta = document.createElement("p");
        seatsMeta.className = "room-meta";
        seatsMeta.textContent = roomSeatsMeta(room);

        const progress = document.createElement("p");
        progress.className = "room-meta";
        progress.textContent = moveSummary(room);

        const activity = document.createElement("p");
        activity.className = "room-meta";
        activity.textContent = activitySummary(room);

        const actions = document.createElement("div");
        actions.className = "room-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "danger-button";
        deleteBtn.textContent = "Delete room";
        deleteBtn.addEventListener("click", () => {
            const ok = window.confirm(`Delete room "${name}"? This cannot be undone.`);
            if (!ok) {
                return;
            }
            void deleteRoom(name);
        });

        actions.appendChild(deleteBtn);
        item.appendChild(title);
        item.appendChild(statusMeta);
        item.appendChild(seatsMeta);
        item.appendChild(progress);
        item.appendChild(activity);
        item.appendChild(actions);
        roomListEl.appendChild(item);
    }
}

function start(): void {
    if (!isFirebaseConfigured()) {
        setNotice("Firebase is not configured.");
        return;
    }

    setNotice("Connecting to rooms…");
    roomsWatchdog = window.setTimeout(() => {
        if (!firstRoomsSnapshotReceived) {
            setNotice("No room update received yet. Check Firebase connection/rules.");
        }
    }, 5000);

    const roomsRef = ref(db, "rooms");
    onValue(
        roomsRef,
        (snap) => {
            try {
                firstRoomsSnapshotReceived = true;
                if (roomsWatchdog !== null) {
                    window.clearTimeout(roomsWatchdog);
                    roomsWatchdog = null;
                }

                const data = (snap.val() ?? {}) as Record<string, RoomRow>;
                const rows = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
                renderRooms(rows);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                setNotice(`Room list processing failed: ${message}`);
            }
        },
        (error) => {
            if (roomsWatchdog !== null) {
                window.clearTimeout(roomsWatchdog);
                roomsWatchdog = null;
            }
            setNotice(`Failed to load rooms: ${error.message}`);
        },
    );

    setInterval(() => {
        if (latestRows.length === 0) {
            return;
        }
        renderRooms(latestRows);
    }, 30_000);
}

start();
