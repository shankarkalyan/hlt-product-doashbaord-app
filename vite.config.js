import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use relative base only at build time so the dist/ folder is fully
  // portable (file:// or any static server). For `vite dev`, keep the
  // absolute base so the dev server can resolve /src/main.jsx correctly.
  base: command === "build" ? "./" : "/",
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
}));
