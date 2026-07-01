import "../styles.css";
import { onValue, ref, remove } from "firebase/database";
import { db, isFirebaseConfigured } from "../firebase/app";
import { getBoardCapacity as getTriangleBoardCapacity } from "../games/triangle-chess/logic";

type SeatMap = { 0?: string; 1?: string };

type RoomRow = {
    game?: string;
    state?: unknown;
    status?: string;
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

function setNotice(msg: string): void {
    noticeEl.textContent = msg;
}

function roomTitle(name: string, room: RoomRow): string {
    const game = room.game ?? "unknown-game";
    return `${name} (${game})`;
}

function roomMeta(room: RoomRow): string {
    const s0 = room.seats?.[0] ?? "-";
    const s1 = room.seats?.[1] ?? "-";
    const winner = typeof room.winner === "number" ? `, winner: ${room.winner}` : "";
    return `status: ${room.status ?? "unknown"}${winner} | seats: [0] ${s0}, [1] ${s1}`;
}

function moveSummary(room: RoomRow): string {
    const moveCount = typeof room.moveCount === "number" ? room.moveCount : 0;

    if (room.game === "triangle-chess") {
        const pegs = Array.isArray((room.state as { pegs?: unknown[] } | undefined)?.pegs)
            ? (room.state as { pegs?: unknown[] }).pegs!.length
            : 0;
        const total = getTriangleBoardCapacity();
        return `moves: ${moveCount} | pegs: ${pegs}/${total}`;
    }

    if (room.game === "connect-four") {
        const board = Array.isArray((room.state as { board?: unknown[] } | undefined)?.board)
            ? (room.state as { board?: unknown[] }).board!
            : [];
        const discs = board.reduce<number>(
            (sum, value) => (typeof value === "number" && value !== 0 ? sum + 1 : sum),
            0,
        );
        return `moves: ${moveCount} | discs: ${discs}/42`;
    }

    return `moves: ${moveCount}`;
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

        const meta = document.createElement("p");
        meta.className = "room-meta";
        meta.textContent = roomMeta(room);

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
        item.appendChild(meta);
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

    const roomsRef = ref(db, "rooms");
    onValue(roomsRef, (snap) => {
        const data = (snap.val() ?? {}) as Record<string, RoomRow>;
        const rows = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
        renderRooms(rows);
    });

    setInterval(() => {
        if (latestRows.length === 0) {
            return;
        }
        renderRooms(latestRows);
    }, 30_000);
}

start();
