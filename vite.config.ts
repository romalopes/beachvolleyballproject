/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
      "/rails": {
        // Active Storage serves organisation logos via its blob-proxy route.
        // The API returns that route as a relative path, so the SPA's origin
        // must forward it to the API — same trick as "/api", and for the same
        // reason: the browser must never talk to the API's self-signed
        // certificate directly.
        target: "https://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
