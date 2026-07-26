import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The app always calls the API through the same-origin relative path
 * `/api/run` (see docs/internal/plans/001-prototype/infrastructure.md).
 * In production Cloudflare passes `/api/*` through to the tunnel origin; in
 * development this proxy plays that role so the code path stays identical.
 */
const API_DEV_SERVER = "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: API_DEV_SERVER,
        changeOrigin: false,
      },
    },
  },
  build: {
    // Monaco is loaded as one lazy chunk; its size is expected.
    chunkSizeWarningLimit: 4096,
  },
});
