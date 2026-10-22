import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Confirm the FastAPI port with Christan.
      "/api": "http://localhost:8000",
    },
  },
});
