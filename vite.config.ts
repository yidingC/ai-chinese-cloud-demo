/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin/index.html")
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"]
  }
});
