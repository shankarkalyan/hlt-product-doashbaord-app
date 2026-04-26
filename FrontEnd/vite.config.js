import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built dist/ runs from anywhere — including
  // file:// (just opening dist/index.html) or any static file server,
  // without needing Node/Vite on the target machine.
  base: "./",
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
});
