import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri loads the built app from a custom protocol; absolute `/assets/...` paths break in production.
export default defineConfig({
  base: "./",
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
  },
});
