import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    css: false,
    exclude: ["**/node_modules/**", "**/e2e/**"],
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8080",
      VIDIO_API_BASE_URL: "http://localhost:8080",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
