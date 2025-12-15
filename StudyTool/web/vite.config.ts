import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env vars
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    base: process.env.NODE_ENV === "production" ? "./" : "/",
    resolve: {
      alias: {
        // Alias for assets - works both in Docker (assets at /build/assets) and local dev (assets at ../../assets)
        "../../assets": path.resolve(__dirname, "../assets"),
      },
    },
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
    // Expose env vars to client (prefixed with VITE_)
    envPrefix: 'VITE_',
  };
});
