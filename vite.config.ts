import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-page app: the lobby (index.html) and the game page (game.html)
// are both static entry points. Add future standalone pages here.
export default defineConfig({
  // Relative base so the built site works under a GitHub Pages subpath
  // (e.g. https://user.github.io/BoardGameHub/).
  base: "./",
  build: {
    rollupOptions: {
      input: {
        lobby: resolve(__dirname, "index.html"),
        game: resolve(__dirname, "game.html"),
      },
    },
  },
});
