import { test, expect, type Page } from "@playwright/test";
import { createDemo } from "../lib/demo.ts";
import { STORAGE_KEY } from "../lib/storage.ts";

let errors: string[];
let serviceRequests: string[];

test.beforeEach(async ({ page }) => {
  errors = []; serviceRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (/\/api\//.test(request.url())) serviceRequests.push(request.url()); });
  await page.clock.install({ time: new Date("2026-10-22T02:00:00Z") });
  await page.goto("/");
});
test.afterEach(() => { expect(errors).toEqual([]); expect(serviceRequests).toEqual([]); });

async function demo(page: Page) {
  await page.getByRole("button", { name: "Load fictional demo" }).click();
  await expect(page.getByRole("region", { name: "Current opportunity" })).toContainText("FICTIONAL DEMONSTRATION");
}
function requirement(page: Page, name: string) { return page.getByRole("article", { name, exact: true }); }
function advisory(page: Page) { return page.getByLabel("Preparation advisory"); }

test("initial product renders without a backend or AI error screen", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /Know your gaps.*Find your next move/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create workspace" })).toBeVisible();
  await expect(page.getByText("No account or AI service required", { exact: false })).toBeVisible();
  await expect(page.getByText("ALMA inference is unavailable.")).toHaveCount(0);
});

test("create an opportunity, with zero requirements explicitly needing setup", async ({ page }) => {
  await page.getByLabel("Opportunity title", { exact: true }).fill("Office equipment supply");
  await page.getByLabel("Organization", { exact: true }).fill("Example buyer");
  await page.getByLabel("Submission deadline", { exact: true }).fill("2026-11-01");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(advisory(page)).toContainText("Setup Required");
  await expect(page.getByText("Not assessed", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("fictional demo has six requirements, five days, and a mandatory two-day overrun", async ({ page }) => {
  await demo(page);
  await expect(page.getByRole("article")).toHaveCount(6);
  await expect(advisory(page)).toContainText("Critical Blocker");
  await expect(page.getByLabel("Readiness summary")).toContainText("5");
  await expect(page.locator(".blocker-panel")).toContainText("exceeds the 5-day window by 2");
  await expect(page.getByLabel("Gap-to-Go actions").locator(".action-item").first()).toContainText("Signed product specification sheet");
  await expect(page.getByText("Saved locally in this browser", { exact: true })).toBeVisible();
});

test("a shorter estimate removes overrun without completing a missing requirement", async ({ page }) => {
  await demo(page);
  const card = requirement(page, "Signed product specification sheet");
  await card.getByLabel("Estimated preparation days", { exact: true }).fill("3");
  await expect(advisory(page)).toContainText("Action Required");
  await expect(card.getByLabel("Preparation status")).toHaveValue("missing");
  await expect(card).toContainText("2 calendar days of buffer");
  await card.getByLabel("Preparation status").selectOption("ready");
  await expect(advisory(page)).toContainText("2 mandatory requirements remain");
  await requirement(page, "Supplier registration").getByLabel("Preparation status").selectOption("ready");
  await requirement(page, "Delivery commitment").getByLabel("Preparation status").selectOption("ready");
  await expect(advisory(page)).toContainText("Ready for Review");
  await expect(advisory(page)).toContainText("1 optional item(s) remain unresolved");
  await expect(page.getByLabel("Gap-to-Go actions").locator(".action-item")).toHaveCount(1);
});

test("requirement creation, full editing, and removal preserve stable IDs", async ({ page }) => {
  await demo(page);
  await page.getByLabel("New requirement title").fill("Custom technical certificate");
  await page.getByRole("button", { name: "Add requirement", exact: true }).click();
  let card = requirement(page, "Custom technical certificate");
  await card.getByLabel("Requirement title", { exact: true }).fill("Updated technical certificate");
  card = requirement(page, "Updated technical certificate");
  await card.getByLabel("Preparation status").selectOption("claimed");
  await card.getByLabel("Reference page (optional)").fill("12");
  await card.getByLabel("Notes / reference details (optional)").fill("User entered supporting-record reference");
  await expect(page.getByText("Saved locally in this browser", { exact: true })).toBeVisible();
  const savedIds = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).workspace.requirements.map((entry: { id: string }) => entry.id), STORAGE_KEY);
  await page.reload();
  card = requirement(page, "Updated technical certificate");
  await expect(card.getByLabel("Preparation status")).toHaveValue("claimed");
  await expect(card.getByLabel("Reference page (optional)")).toHaveValue("12");
  await expect(card.getByLabel("Notes / reference details (optional)")).toHaveValue("User entered supporting-record reference");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).workspace.requirements.map((entry: { id: string }) => entry.id), STORAGE_KEY)).toEqual(savedIds);
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Remove Updated technical certificate" }).click();
  await expect(page.getByRole("article")).toHaveCount(6);
});

test("mandatory toggle changes blockers and action ordering instantly", async ({ page }) => {
  await demo(page);
  await requirement(page, "Signed product specification sheet").getByLabel("Mandatory requirement", { exact: true }).uncheck();
  await expect(advisory(page)).toContainText("Action Required");
  await expect(page.getByLabel("Gap-to-Go actions").locator(".action-item").first()).toContainText("Delivery commitment");
  await requirement(page, "Supplier registration").getByLabel("Preparation status").selectOption("conflict");
  await expect(advisory(page)).toContainText("Critical Blocker");
  await expect(page.getByLabel("Gap-to-Go actions").locator(".action-item").first()).toContainText("Supplier registration");
});

test("opportunity and deadline edits recalculate, including yesterday and today", async ({ page }) => {
  await demo(page);
  await page.getByText("Edit opportunity details", { exact: true }).click();
  await page.getByLabel("Opportunity title", { exact: true }).fill("Updated office opportunity");
  await page.getByLabel("Submission deadline", { exact: true }).fill("2026-10-21");
  await expect(page.locator(".blocker-panel")).toContainText("Submission date passed");
  await page.getByLabel("Submission deadline", { exact: true }).fill("2026-10-22");
  await expect(advisory(page)).toContainText("Deadline is today");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Updated office opportunity" })).toBeVisible();
});

test("high recorded completion cannot mask a mandatory blocker", async ({ page }) => {
  const data = createDemo("2026-10-22", "high-progress", "2026-10-22T02:00:00.000Z");
  data.requirements = Array.from({ length: 9 }, (_, index) => ({ ...data.requirements[0]!, id: "ready-" + index, title: "Prepared item " + index }));
  data.requirements.push({ id: "critical", title: "Critical missing record", status: "missing", mandatory: true, estimatedDays: 7, referencePage: null, notes: "" });
  await page.evaluate(({ key, workspace }) => localStorage.setItem(key, JSON.stringify({ version: 1, workspace })), { key: STORAGE_KEY, workspace: data });
  await page.reload();
  await expect(page.getByText("90% recorded ready", { exact: true })).toBeVisible();
  await expect(advisory(page)).toContainText("Critical Blocker");
});

test("negative estimates stop assessment and cannot replace last valid saved data", async ({ page }) => {
  await demo(page);
  const card = requirement(page, "Signed product specification sheet");
  await card.getByLabel("Estimated preparation days").fill("-1");
  await expect(advisory(page)).toContainText("Setup Required");
  await expect(card.getByRole("alert")).toContainText("zero or more");
  await expect(page.locator(".save-state")).toContainText("not saved");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).workspace.requirements.find((entry: { id: string }) => entry.id === "demo-specification").estimatedDays, STORAGE_KEY);
  expect(saved).toBe(7);
  await card.getByLabel("Estimated preparation days").fill("");
  await expect(card).toContainText("deadline feasibility is unknown");
});

test("blank titles and noninteger reference pages are invalid, not coerced", async ({ page }) => {
  await demo(page);
  const card = requirement(page, "Business permit");
  await card.getByLabel("Reference page (optional)").fill("1.5");
  await expect(card.getByRole("alert")).toContainText("positive whole number");
  await card.getByLabel("Reference page (optional)").fill("");
  await page.getByText("Edit opportunity details", { exact: true }).click();
  await page.getByLabel("Opportunity title", { exact: true }).fill("   ");
  await expect(advisory(page)).toContainText("Setup Required");
});

test("corrupt storage is rejected and only replaced after an explicit new action", async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, "broken-json"), STORAGE_KEY);
  await page.reload();
  await expect(page.locator(".notice").filter({ hasText: /Saved data is corrupt or uses an unsupported schema/ })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe("broken-json");
  await demo(page);
  await expect(page.getByText(/Saved data is corrupt or uses an unsupported schema/)).toHaveCount(0);
});

test("blocked storage never crashes or claims a successful save", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Denied", "SecurityError"); } }));
  await page.reload();
  await demo(page);
  await expect(page.locator(".save-state")).toContainText("Unable to save");
  await expect(advisory(page)).toContainText("Critical Blocker");
});

test("reloading demo is a protected, repeatable reset with a rolling deadline", async ({ page }) => {
  await demo(page);
  await requirement(page, "Signed product specification sheet").getByLabel("Estimated preparation days").fill("3");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Load fictional demo" }).click();
  await expect(requirement(page, "Signed product specification sheet").getByLabel("Estimated preparation days")).toHaveValue("3");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Load fictional demo" }).click();
  await expect(requirement(page, "Signed product specification sheet").getByLabel("Estimated preparation days")).toHaveValue("7");
  await expect(page.getByRole("region", { name: "Current opportunity" })).toContainText("2026-10-27");
});

test("core interactions continue with network disabled after resources load", async ({ page, context }) => {
  await context.setOffline(true);
  await demo(page);
  await requirement(page, "Signed product specification sheet").getByLabel("Estimated preparation days").fill("3");
  await expect(advisory(page)).toContainText("Action Required");
  await context.setOffline(false);
});

for (const [name, width, height] of [["desktop", 1365, 900], ["tablet", 820, 1180], ["mobile", 390, 844]] as const) {
  test(`${name} has readable controls without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await demo(page);
    await expect(requirement(page, "Signed product specification sheet").getByLabel("Preparation status")).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/readiness-" + name + ".png", fullPage: true });
  });
}
