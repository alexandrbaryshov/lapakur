import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" — собранный dist/index.html открывается с относительными путями
// (и из file://, и из любой подпапки хостинга).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
    // медиа живёт в public/media и копируется как есть; в бандл ничего не инлайним крупнее 4 КБ
    assetsInlineLimit: 4096,
  },
});
