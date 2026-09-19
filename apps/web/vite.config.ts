import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getColorSchemeBootstrapScript } from "./src/lib/colorSchemeBootstrap";

/**
 * The app always calls the API through the same-origin relative path
 * `/api/run` (see docs/internal/specs/deployment.md).
 * In production Cloudflare passes `/api/*` through to the tunnel origin; in
 * development this proxy plays that role so the code path stays identical.
 */
const API_DEV_SERVER = "http://localhost:8080";

const colorSchemeBootstrapPlugin = {
  name: "qemu-playground-color-scheme-bootstrap",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        attrs: { "data-mantine-script": true },
        children: getColorSchemeBootstrapScript(),
        injectTo: "head-prepend" as const,
      },
    ];
  },
};

export default defineConfig({
  plugins: [react(), colorSchemeBootstrapPlugin],
  server: {
    proxy: {
      "/api": {
        target: API_DEV_SERVER,
        changeOrigin: false,
      },
    },
  },
});
