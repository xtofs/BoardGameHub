import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-page app: the lobby (index.html) and the game page (game.html)
// are both static entry points. Add future standalone pages here.
export default defineConfig({
  // GitHub Pages project site base path.
  base: "/BoardGameHub/",
  build: {
    rollupOptions: {
      input: {
        lobby: resolve(__dirname, "index.html"),
        game: resolve(__dirname, "game.html"),
        admin: resolve(__dirname, "admin.html"),
      },
    },
  },
});
