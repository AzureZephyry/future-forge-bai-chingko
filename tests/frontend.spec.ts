import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import type { AnalysisResponse } from "../types";

const python = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
const pdf = execFileSync(python, ["-B", "-m", "tests.fixture_backend"], { windowsHide: true });
const profile = {
  business_name: "Harborleaf Paper Supply (fictional)",
  industry: "Office supplies",
  business_permit: "unknown",
  registration: "unknown",
  delivery_capacity: "100 boxes of A4 recycled paper available; signed specification sheet missing; lead time unknown.",
};
let demo: AnalysisResponse;
let browserErrors: string[];

interface Submission {
  fields: string[];
  profile: unknown;
  filename: string;
  size: number;
  contentType: string | null;
}

declare global {
  interface Window { bidbridgeTestSubmissions: Submission[] }
}

async function fillProfile(page: Page) {
  await page.getByLabel("Business name", { exact: true }).fill(profile.business_name);
  await page.getByLabel("Industry", { exact: true }).fill(profile.industry);
  await page.getByLabel("Delivery capacity", { exact: true }).fill(profile.delivery_capacity);
}

async function choosePdf(page: Page) {
  await page.getByLabel("Choose procurement PDF").setInputFiles({
    name: "tender.pdf", mimeType: "application/pdf", buffer: pdf,
  });
}

async function ready(page: Page) {
  await fillProfile(page);
  await choosePdf(page);
}

test.beforeAll(async ({ request }) => {
  const response = await request.post("http://127.0.0.1:8766/api/analyze", {
    multipart: {
      tender_file: { name: "tender.pdf", mimeType: "application/pdf", buffer: pdf },
      supplier_profile: JSON.stringify(profile),
    },
  });
  expect(response.status()).toBe(200);
  demo = await response.json() as AnalysisResponse;
});

test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  // Browser protocols can omit multipart postData for file uploads. Observe the
  // real FormData before fetch, then let the request reach the real backend.
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.bidbridgeTestSubmissions = [];
    window.fetch = (input, init) => {
      if (init?.body instanceof FormData) {
        const file = init.body.get("tender_file") as File;
        window.bidbridgeTestSubmissions.push({
          fields: [...init.body.keys()],
          profile: JSON.parse(String(init.body.get("supplier_profile"))),
          filename: file.name,
          size: file.size,
          contentType: new Headers(init.headers).get("content-type"),
        });
      }
      return original(input, init);
    };
  });
});

test.afterEach(() => expect(browserErrors).toEqual([]));

test("required inputs block submission and whitespace is not a business name", async ({ page }) => {
  const submit = page.getByRole("button", { name: "Analyze Bid Readiness", exact: true });
  await expect(submit).toBeDisabled();
  await choosePdf(page);
  await expect(submit).toBeDisabled();
  await fillProfile(page);
  await expect(submit).toBeEnabled();
  await page.getByLabel("Business name", { exact: true }).fill("   ");
  await expect(submit).toBeDisabled();
});

test("real browser upload reaches FastAPI and renders canonical Gap-to-Go results", async ({ page }) => {
  await expect(page.getByText("Fixture demo · No live AI", { exact: true })).toBeVisible();
  await ready(page);
  const pending = page.waitForRequest((request) => request.url().endsWith("/api/analyze"));
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  const request = await pending;
  expect(request.headers()["content-type"]).toContain("multipart/form-data; boundary=");
  expect(await page.evaluate(() => window.bidbridgeTestSubmissions[0])).toEqual({
    fields: ["tender_file", "supplier_profile"], profile,
    filename: "tender.pdf", size: pdf.length, contentType: null,
  });
  await expect(page.locator("article")).toHaveCount(3);
  for (const expected of demo.requirements) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: `${expected.id} ${expected.requirement}`, exact: true }) });
    await expect(card).toContainText(expected.reason);
    await expect(card).toContainText(expected.next_action);
    for (const source of expected.sources) {
      await expect(card).toContainText(source.excerpt);
      await expect(card).toContainText(source.document);
      await expect(card).toContainText(`Page ${source.page}`);
    }
  }
  await expect(page.locator("article .badge--self_reported_match")).toHaveText("Self-reported (not verified)");
  await expect(page.locator("article .badge--missing")).toHaveText("Missing");
  await expect(page.locator("article .badge--unknown")).toHaveText("Unknown");
  await expect(page.getByLabel("Assessment limitations")).toContainText(demo.uncertainty);
  await expect(page.getByText("Advisory only. Not an official eligibility decision.")).toBeVisible();
  await page.screenshot({ path: "test-results/full-stack-desktop.png", fullPage: true });
});

test("multiple citations, unavailable pages, and all five statuses render without invented metadata", async ({ page }) => {
  const payload = structuredClone(demo);
  payload.requirements[0]!.sources.push({ ...payload.requirements[1]!.sources[0]!, page: null });
  payload.requirements.push(
    { ...payload.requirements[0]!, id: "ui-documented", status: "documented_match" },
    { ...payload.requirements[1]!, id: "ui-conflict", status: "conflict" },
  );
  await page.route("**/api/analyze", (route) => route.fulfill({ json: payload }));
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  const first = page.locator("article").first();
  await expect(first.locator("blockquote")).toHaveCount(2);
  await expect(first).toContainText("Page unavailable");
  await expect(first).not.toContainText("Page null");
  await expect(page.locator("article .badge--documented_match")).toHaveText("Documented match");
  await expect(page.locator("article .badge--conflict")).toHaveText("Conflict");
});

test("reassessment retains inputs and flags the old result until submitted again", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(3);
  await page.getByLabel("Delivery capacity", { exact: true }).fill("Updated supplier claim; not independently verified.");
  await expect(page.getByText(/Inputs changed\. These findings reflect your previous submission/)).toBeVisible();
  await expect(page.getByText("tender.pdf", { exact: true })).toBeVisible();
  const request = page.waitForRequest((item) => item.url().endsWith("/api/analyze"));
  await page.getByRole("button", { name: "Reassess Bid Readiness" }).click();
  await request;
  expect(await page.evaluate(() => window.bidbridgeTestSubmissions.at(-1)!.profile)).toEqual({
    ...profile, delivery_capacity: "Updated supplier claim; not independently verified.",
  });
  await expect(page.getByText(/Inputs changed\. These findings reflect your previous submission/)).toHaveCount(0);
  await expect(page.getByLabel("Delivery capacity", { exact: true })).toHaveValue("Updated supplier claim; not independently verified.");
  await expect(page.locator("article .badge--self_reported_match")).toBeVisible();
  await expect(page.getByText("Status changed", { exact: true })).toHaveCount(0);
});

test("loading prevents duplicate submissions and locks input changes", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/analyze", async (route) => {
    calls += 1;
    await gate;
    await route.fulfill({ json: demo });
  });
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  const pending = page.getByRole("button", { name: "Analyzing...", exact: true });
  await expect(pending).toBeDisabled();
  await expect(page.getByLabel("Business name", { exact: true })).toBeDisabled();
  await pending.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  release();
  await expect(page.locator("article")).toHaveCount(3);
  expect(calls).toBe(1);
});

test("PDF removal permits selecting the same file again", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Remove PDF" }).click();
  await expect(page.getByText("tender.pdf", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyze Bid Readiness", exact: true })).toBeDisabled();
  await choosePdf(page);
  await expect(page.getByRole("button", { name: "Analyze Bid Readiness", exact: true })).toBeEnabled();
});

for (const [name, size, message] of [
  ["not-pdf.txt", 10, "Choose a PDF file (.pdf)."],
  ["empty.pdf", 0, "The selected file is empty."],
  ["too-large.pdf", 15 * 1024 * 1024 + 1, "Choose a PDF no larger than 15 MiB."],
] as const) {
  test(`file validation: ${name}`, async ({ page }) => {
    await page.getByLabel("Choose procurement PDF").setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.alloc(size) });
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByRole("button", { name: "Analyze Bid Readiness", exact: true })).toBeDisabled();
  });
}

for (const [code, message] of [
  [422, "Check your supplier details"], [503, "Analysis is unavailable"],
  [502, "could not produce a valid result"], [500, "server could not process the tender"],
] as const) {
  test(`HTTP ${code} has a readable message and preserves inputs`, async ({ page }) => {
    await page.route("**/api/analyze", (route) => route.fulfill({ status: code, json: { detail: [{ msg: "private diagnostics" }] } }));
    await ready(page);
    await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByRole("alert")).not.toContainText("private diagnostics");
    await expect(page.getByLabel("Business name", { exact: true })).toHaveValue(profile.business_name);
    await expect(page.getByText("tender.pdf", { exact: true })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);
  });
}

test("production-default backend returns an honest unavailable-service UI", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    const response = await route.fetch({ url: "http://127.0.0.1:8767/api/analyze" });
    expect(response.status()).toBe(503);
    await route.fulfill({ response });
  });
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Analysis is unavailable");
  await expect(page.locator("article")).toHaveCount(0);
});

test("network failure never creates mock results", async ({ page }) => {
  await page.route("**/api/analyze", (route) => route.abort("failed"));
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot reach the backend");
  await expect(page.locator("article")).toHaveCount(0);
});

test("a failed reassessment labels retained findings instead of implying a new result", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(3);
  await page.route("**/api/analyze", (route) => route.fulfill({ status: 503, json: { detail: "Unavailable" } }));
  await page.getByRole("button", { name: "Reassess Bid Readiness" }).click();
  await expect(page.getByRole("alert")).toContainText("Analysis is unavailable");
  await expect(page.getByText(/Showing the last successful assessment; no new result was produced/)).toBeVisible();
  await expect(page.locator("article")).toHaveCount(3);
});

test("an internal AI-shaped response is rejected instead of crashing", async ({ page }) => {
  await page.route("**/api/analyze", (route) => route.fulfill({ json: { requirements: [], uncertainty: "Wrong HTTP schema" } }));
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("unsupported assessment");
});

test("null source and an empty assessment retain uncertainty", async ({ page }) => {
  const payload = structuredClone(demo);
  payload.requirements[0]!.source = null;
  payload.requirements[0]!.sources = [];
  await page.route("**/api/analyze", (route) => route.fulfill({ json: payload }));
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.locator("article").first()).toContainText("No source passage was supplied.");
  payload.requirements = [];
  await page.getByRole("button", { name: "Reassess Bid Readiness" }).click();
  await expect(page.getByText("No requirements were established.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Assessment limitations")).toContainText(payload.uncertainty);
});

test("mobile layout keeps the form, actions, and citations readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole("button", { name: "Analyze Bid Readiness", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/full-stack-mobile.png", fullPage: true });
});
