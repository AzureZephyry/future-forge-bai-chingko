import { defineConfig } from "@playwright/test";

const python = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";

export default defineConfig({
  testDir: "./tests/legacy",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `"${python}" -B -m uvicorn tests.fixture_backend:create_fixture_app --factory --host 127.0.0.1 --port 8766`,
      env: { BIDBRIDGE_TEST_MODE: "1" },
      url: "http://127.0.0.1:8766/api/health",
      reuseExistingServer: false,
    },
    {
      command: `"${python}" -B -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8767`,
      url: "http://127.0.0.1:8767/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 4173 --strictPort",
      env: {
        VITE_BACKEND_PROXY_TARGET: "http://127.0.0.1:8766",
        VITE_API_BASE_URL: "",
        VITE_DEMO_MODE: "true",
      },
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
  ],
});
