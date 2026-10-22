import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      // Match API paths only: /api would also proxy the frontend's /api.ts module.
      "^/api/": loadEnv(mode, process.cwd(), "VITE_").VITE_BACKEND_PROXY_TARGET || "http://127.0.0.1:8000",
    },
  },
}));
