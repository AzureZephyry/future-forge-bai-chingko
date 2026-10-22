import { defineConfig } from "@playwright/test";

export default defineConfig({ testDir: "./tests/unit", testMatch: "**/*.test.ts", workers: 1, reporter: "list" });
