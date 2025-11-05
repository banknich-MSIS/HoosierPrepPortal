import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  server: {
    port: 5173,
    host: "127.0.0.1",
    strictPort: true,
  },
  build: {
    outDir: "dist-vite",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        // Ensure relative paths for Electron file:// protocol
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
