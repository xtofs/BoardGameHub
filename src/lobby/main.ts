import "../styles.css";
import { listGames } from "../games/registry";

const gameList = document.getElementById("game-list") as HTMLUListElement;
const form = document.getElementById("join-form") as HTMLFormElement;
const roomInput = document.getElementById("room") as HTMLInputElement;
const playerInput = document.getElementById("player") as HTMLInputElement;
const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

let selectedGameId: string | null = null;

// Render one selectable button per registered game.
for (const game of listGames()) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = game.name;
  btn.addEventListener("click", () => {
    selectedGameId = game.id;
    for (const el of gameList.querySelectorAll("button")) {
      el.classList.toggle("selected", el === btn);
    }
    updateSubmitState();
  });
  li.appendChild(btn);
  gameList.appendChild(li);
}

function updateSubmitState(): void {
  submitBtn.disabled =
    !selectedGameId || !roomInput.value.trim() || !playerInput.value.trim();
}

roomInput.addEventListener("input", updateSubmitState);
playerInput.addEventListener("input", updateSubmitState);
updateSubmitState();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedGameId) return;
  const params = new URLSearchParams({
    game: selectedGameId,
    room: roomInput.value.trim(),
    player: playerInput.value.trim(),
  });
  window.location.href = `game.html?${params.toString()}`;
});
