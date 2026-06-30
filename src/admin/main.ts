import "../styles.css";
import { onValue, ref, remove } from "firebase/database";
import { db, isFirebaseConfigured } from "../firebase/app";

type SeatMap = { 0?: string; 1?: string };

type RoomRow = {
    game?: string;
    status?: string;
    winner?: number;
    seats?: SeatMap;
};

const noticeEl = document.getElementById("admin-notice") as HTMLDivElement;
const roomListEl = document.getElementById("room-list") as HTMLUListElement;

const deleting = new Set<string>();

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
}

start();
