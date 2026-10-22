import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pdf, png, note } from "./fileFixtures";
import { STORAGE_KEY } from "../lib/storage.ts";
import { DATABASE_NAME } from "../lib/documents.ts";

let errors: string[], external: string[];
test.beforeEach(async ({ page }) => {
  errors = []; external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (/\/api\//.test(request.url()) || (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:4173/"))) external.push(request.url()); });
  await page.clock.install({ time: new Date("2026-10-22T02:00:00Z") });
  await page.goto("/app/documents");
  await expect(page.getByLabel("Choose supporting files")).toBeEnabled();
});
test.afterEach(() => { expect(errors).toEqual([]); expect(external).toEqual([]); });
const quota = (page: Page) => page.getByLabel("Plan and upload allowance").first();
const library = (page: Page) => page.getByRole("region", { name: "Saved documents" });
type UploadFile = { name: string; mimeType: string; buffer: Buffer };
async function upload(page: Page, files: UploadFile | UploadFile[]) {
  await page.getByLabel("Choose supporting files").setInputFiles(files);
  await expect(page.getByText("Saving files to this browser…", { exact: true })).toHaveCount(0);
  await expect(page.locator(".upload-results")).toBeVisible();
}
async function activate(page: Page) {
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Preview Pro Weekly", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("No payment, account creation, or automatic renewal");
  await page.getByRole("button", { name: "Activate Demo Pro", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restart 7-day demo period" })).toBeVisible();
}
async function snapshot(page: Page) {
  return page.evaluate(async () => { const path = "/lib/documents.ts"; const api: typeof import("../lib/documents.ts") = await import(path); return api.getCommercialSnapshot(); });
}

test("Free accepts exactly three files, blocks the fourth, and survives refresh", async ({ page }) => {
  await expect(quota(page)).toContainText("3 of 3 uploads remaining");
  for (let i = 1; i <= 3; i++) { await upload(page, note(`record-${i}.txt`)); await expect(quota(page)).toContainText(`${3-i} of 3 uploads remaining`); }
  await upload(page, note("fourth.txt"));
  await expect(page.locator(".upload-results")).toContainText("0 accepted · 1 not accepted");
  await expect(library(page).getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Free allowance reached" })).toContainText("Existing files and all preparation tools remain available");
  await page.reload();
  await expect(quota(page)).toContainText("0 of 3 uploads remaining");
  await expect(library(page).getByRole("article")).toHaveCount(3);
});
test("batch selection with two slots accepts two and explains three rejections", async ({ page }) => {
  await upload(page, note("first.txt"));
  await upload(page, Array.from({length: 5}, (_,i) => note(`batch-${i}.txt`)));
  await expect(page.locator(".upload-results")).toContainText("2 accepted · 3 not accepted");
  await expect(library(page).getByRole("article")).toHaveCount(3);
  expect((await snapshot(page)).usage.acceptedCount).toBe(3);
});
test("empty selection, unsupported, oversized and mismatched-content files consume no allowance", async ({ page }) => {
  await page.getByLabel("Choose supporting files").setInputFiles([]);
  await expect(quota(page)).toContainText("3 of 3 uploads remaining");
  await upload(page, [note("script.html"), {name:"large.txt",mimeType:"text/plain",buffer:Buffer.alloc(10*1024*1024+1)}, { name:"false.pdf",mimeType:"application/pdf",buffer:Buffer.from("<script>bad</script>") }]);
  await expect(page.locator(".upload-results")).toContainText("0 accepted · 3 not accepted");
  await expect(quota(page)).toContainText("3 of 3 uploads remaining");
  expect((await snapshot(page)).documents).toHaveLength(0);
});
test("PDF and image acceptance supports local preview and retrieval", async ({ page }) => {
  await upload(page, [pdf, png]);
  await expect(library(page).getByRole("article")).toHaveCount(2);
  await library(page).getByRole("article", { name: "sample.png" }).getByRole("button", { name:"Open file" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("img")).toBeVisible();
  await expect.poll(() => dialog.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await dialog.getByRole("button", { name:"Close preview" }).click();
  await library(page).getByRole("article", { name:pdf.name }).getByRole("button", { name:"Open file" }).click();
  await expect(dialog.locator("iframe")).toHaveAttribute("sandbox", "");
  await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
});
test("text preview never executes markup, downloads preserve bytes, duplicate names count separately", async ({ page }) => {
  const contents = "<script>throw new Error('must not execute')</script>\nFictional evidence";
  await upload(page, [note("same.txt", contents), note("same.txt", contents)]);
  await expect(library(page).getByRole("article")).toHaveCount(2);
  await expect(quota(page)).toContainText("1 of 3 uploads remaining");
  await library(page).getByRole("article").first().getByRole("button", { name:"Open file" }).click();
  await expect(page.getByRole("dialog").locator("pre")).toHaveText(contents);
  await expect(page.getByRole("dialog").locator("script")).toHaveCount(0);
  await page.getByRole("button", { name:"Close preview" }).click();
  const pending = page.waitForEvent("download");
  await library(page).getByRole("article").first().getByRole("button", { name:"Download" }).click();
  const downloaded = await pending;
  expect(await readFile((await downloaded.path())!, "utf8")).toBe(contents);
  await page.reload();
  await expect(library(page).getByRole("article")).toHaveCount(2);
});
test("attachment associations never change readiness and can be removed", async ({ page }) => {
  await page.getByRole("button", { name:"Load fictional demo" }).click();
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.getByRole("navigation", { name:"Application navigation" }).getByRole("link", { name:"Documents", exact:true }).click();
  await page.getByLabel("Associate new files with a requirement (optional)").selectOption("demo-specification");
  await upload(page, pdf);
  await expect(library(page).getByRole("combobox")).toHaveValue("demo-specification");
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
  await page.getByRole("navigation", { name:"Application navigation" }).getByRole("link", { name:"Opportunity", exact:true }).click();
  const card = page.getByRole("article", { name:"Signed product specification sheet", exact:true });
  await expect(card.getByLabel("Preparation status")).toHaveValue("missing");
  await expect(card.locator("..").getByRole("link")).toContainText("1 supporting document");
  await page.getByRole("navigation", { name:"Application navigation" }).getByRole("link", { name:"Documents", exact:true }).click();
  await library(page).getByRole("combobox").selectOption("");
  await expect.poll(async () => (await snapshot(page)).documents[0]!.requirementId).toBeNull();
});
test("deleting a file keeps its consumed allowance and leaves no orphan blob", async ({ page }) => {
  await upload(page, note());
  const id = (await snapshot(page)).documents[0]!.id;
  page.once("dialog", dialog => dialog.accept());
  await library(page).getByRole("button", { name:"Remove file" }).click();
  await expect(library(page).getByRole("article")).toHaveCount(0);
  await expect(quota(page)).toContainText("2 of 3 uploads remaining");
  expect(await page.evaluate(async (id) => { const path="/lib/documents.ts"; const api: typeof import("../lib/documents.ts") = await import(path); try { await api.getDocumentBlob(id); return true; } catch { return false; } }, id)).toBe(false);
});
test("a failed blob write rolls back metadata and usage together", async ({ page }) => {
  await page.evaluate(() => { const original=IDBObjectStore.prototype.add; IDBObjectStore.prototype.add=function(value: unknown,key?: IDBValidKey) { if(this.name === "blobs") throw new DOMException("Simulated full storage", "QuotaExceededError"); return original.call(this,value,key); }; });
  await upload(page, note("cannot-store.txt"));
  await expect(page.locator(".upload-results")).toContainText("No allowance was consumed");
  const actual = await snapshot(page);
  expect(actual.documents).toHaveLength(0); expect(actual.usage.acceptedCount).toBe(0);
});
test("unavailable cross-tab messaging cannot misreport an accepted file as failed", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "BroadcastChannel", { value: class { constructor() { throw new DOMException("Unavailable", "SecurityError"); } } }));
  await page.reload();
  await expect(page.getByLabel("Choose supporting files")).toBeEnabled();
  await upload(page, note("stored-despite-messaging.txt"));
  await expect(page.locator(".upload-results")).toContainText("1 accepted · 0 not accepted");
  await expect(quota(page)).toContainText("2 of 3 uploads remaining");
});
test("loading or replacing the tender does not reset global upload allowance", async ({ page }) => {
  await upload(page, [note("a.txt"), note("b.txt"), note("c.txt")]);
  await page.getByRole("button", { name: "Load fictional demo" }).click();
  await expect(quota(page)).toContainText("0 of 3 uploads remaining");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Load fictional demo" }).click();
  await expect(quota(page)).toContainText("0 of 3 uploads remaining");
  expect((await snapshot(page)).documents).toHaveLength(3);
});
test("Pro activation can be cancelled; confirmed activation lasts 168 hours without billing fields", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("button", { name:"Preview Pro Weekly", exact:true }).click();
  await expect(page.getByRole("button", { name:"Cancel", exact:true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await snapshot(page)).subscription.plan).toBe("free");
  await activate(page);
  const subscription = (await snapshot(page)).subscription;
  expect(Date.parse(subscription.expiresAt!)-Date.parse(subscription.activatedAt!)).toBe(168*3600000);
  expect(subscription.demoOnly).toBe(true);
  await expect(page.locator("input")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name:"Restart 7-day demo period" })).toBeVisible();
});
test("Pro bypasses count limits; ending it restores previously consumed Free quota and keeps files", async ({ page }) => {
  await upload(page, [note("free-1.txt"), note("free-2.txt")]);
  await activate(page);
  await page.goto("/app/documents");
  await upload(page, Array.from({length: 5}, (_,i) => note(`pro-${i}.txt`)));
  await expect(page.locator(".upload-results")).toContainText("5 accepted · 0 not accepted");
  await expect(library(page).getByRole("article")).toHaveCount(7);
  expect((await snapshot(page)).usage.acceptedCount).toBe(2);
  await page.getByRole("navigation", { name:"Application navigation" }).getByRole("link", { name:"Plan & Pricing" }).click();
  await page.getByRole("button", { name:"End demo Pro" }).click();
  await page.getByRole("button", { name:"Return to Free", exact:true }).click();
  await expect(quota(page)).toContainText("1 of 3 uploads remaining");
  expect((await snapshot(page)).documents).toHaveLength(7);
});
test("open-page expiry changes Pro to Free at the stored timestamp", async ({ page }) => {
  await upload(page, [note("used-1.txt"),note("used-2.txt"),note("used-3.txt")]);
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now()))+1000));
  await page.evaluate(async () => { const path="/lib/documents.ts"; const api: typeof import("../lib/documents.ts") = await import(path); await api.setDemoPlan(true, () => new Date(Date.now()-168*3600000+5000)); });
  await expect(quota(page)).toContainText("Pro Weekly");
  await page.clock.runFor(4999);
  await expect(quota(page)).toContainText("Pro Weekly");
  await page.clock.runFor(1);
  await expect(quota(page)).toContainText("0 of 3 uploads remaining");
  await upload(page, note("after-expiry.txt"));
  await expect(page.locator(".upload-results")).toContainText("0 accepted · 1 not accepted");
  expect((await snapshot(page)).documents).toHaveLength(3);
});
test("Free allowance refreshes at local midnight in an open tab", async ({ page }) => {
  await page.clock.setSystemTime(new Date("2026-10-22T15:58:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await upload(page,[note("a.txt"),note("b.txt"),note("c.txt")]);
  await expect(quota(page)).toContainText("0 of 3 uploads remaining");
  await page.clock.pauseAt(new Date("2026-10-22T15:58:10Z"));
  await page.clock.fastForward(110_000);
  await expect(quota(page)).toContainText("3 of 3 uploads remaining");
  await upload(page,note("new-day.txt"));
  await expect(quota(page)).toContainText("2 of 3 uploads remaining");
});
test("resuming after midnight refreshes allowance from the actual local date", async ({ page }) => {
  await upload(page,[note("a.txt"),note("b.txt"),note("c.txt")]);
  await page.clock.setSystemTime(new Date("2026-10-22T16:00:01Z"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(quota(page)).toContainText("3 of 3 uploads remaining");
});
test("concurrent tabs cannot both claim the last Free slot and reconcile their counters", async ({ page, context }) => {
  await upload(page,[note("first.txt"),note("second.txt")]);
  const other = await context.newPage();
  await other.clock.install({ time: new Date("2026-10-22T02:00:00Z") });
  await other.goto("/app/documents");
  await expect(quota(other)).toContainText("1 of 3 uploads remaining");
  await Promise.all([upload(page,note("race-a.txt")),upload(other,note("race-b.txt"))]);
  await expect(quota(page)).toContainText("0 of 3 uploads remaining");
  await expect(quota(other)).toContainText("0 of 3 uploads remaining");
  await expect(library(page).getByRole("article")).toHaveCount(3);
  await expect(library(other).getByRole("article")).toHaveCount(3);
  expect((await snapshot(page)).usage.acceptedCount).toBe(3);
  await other.close();
});
test("Pro activation in another tab updates the open workspace", async ({ page, context }) => {
  const other = await context.newPage();
  await other.clock.install({ time: new Date("2026-10-22T02:00:00Z") });
  await activate(other);
  await expect(quota(page)).toContainText("Pro Weekly");
  await other.close();
});
test("corrupted plan downgrades safely; corrupted quota pauses uploads while retaining files", async ({ page }) => {
  await upload(page,note("kept.txt"));
  await page.evaluate(async (database) => { await new Promise<void>((resolve,reject) => { const open=indexedDB.open(database,1); open.onsuccess=()=>{ const db=open.result,tx=db.transaction(["settings","usage"],"readwrite");tx.objectStore("settings").put({plan:"pro_weekly",demoOnly:false},"subscription");tx.objectStore("usage").put({localDateKey:"2026-10-22",acceptedCount:99});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error); }; }); },DATABASE_NAME);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Saved demo plan was invalid");
  await expect(page.getByLabel("Choose supporting files")).toBeDisabled();
  await expect(library(page).getByRole("article")).toHaveCount(1);
  await expect(quota(page)).not.toContainText("Pro Weekly");
  await page.getByRole("button",{name:"Load fictional demo"}).click();
  await expect(page.getByLabel("Preparation advisory")).toContainText("Critical Blocker");
});
test("unavailable IndexedDB reports an error without blocking preparation tools", async ({ page }) => {
  await page.addInitScript(()=>Object.defineProperty(window,"indexedDB",{get(){throw new DOMException("Blocked","SecurityError");}}));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Local document and plan storage is unavailable");
  await expect(page.getByLabel("Choose supporting files")).toBeDisabled();
  await page.getByRole("button",{name:"Load fictional demo"}).click();
  await expect(page.getByLabel("Preparation advisory")).toContainText("Critical Blocker");
});

const routes = [["/","Know before"],["/features","Less uncertainty"],["/pricing","Start with clarity"],["/app","Know your gaps"],["/app/opportunity","Opportunity & requirements"],["/app/documents","Documents & evidence"],["/app/simulator","A different assumption"],["/app/report","Your bid decision brief"],["/app/plan","Plan & Pricing"]] as const;
for (const [route, heading] of routes) test(`direct visit and refresh work at ${route}`, async ({ page }) => {
  await page.goto(route); await expect(page.getByRole("heading",{level:1})).toContainText(heading);
  await page.reload(); await expect(page.getByRole("heading",{level:1})).toContainText(heading);
});
test("first-time dashboard offers a clear path and a sample opportunity", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("navigation", { name:"Preparation path" }).getByRole("link")).toHaveCount(6);
  await expect(page.getByRole("link", { name:"Create opportunity", exact:true })).toBeVisible();
  await page.getByRole("button", { name:"Try fictional sample" }).click();
  await expect(page).toHaveURL(/\/app\/opportunity$/);
  await expect(page.getByText("FICTIONAL DEMONSTRATION — editable planning example")).toBeVisible();
});
test("marketing hero keeps its routes and the fictional preview uses readiness logic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level:1 })).toContainText("Know before");
  await expect(page.getByRole("link", { name:/Start Free/ }).first()).toHaveAttribute("href", "/app");
  await expect(page.getByRole("link", { name:/Explore Gap-to-Go/ })).toHaveAttribute("href", "/features#simulator");
  await expect(page.getByText("Critical Blocker", { exact:true })).toBeVisible();
  await page.getByRole("button", { name:/Try the change/ }).click();
  await expect(page.getByText("Action Required", { exact:true })).toBeVisible();
  await expect(page.getByText("The timeline improves. The requirement is still missing.")).toBeVisible();
  await page.emulateMedia({ reducedMotion:"reduce" });
  await page.goto("/features");
  await expect(page.getByRole("heading", { level:1 })).toBeVisible();
  await page.getByRole("link", { name:"Open the simulator →" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("link", { name:"Open the simulator →" })).toBeVisible();
});
test("unknown routes provide recovery, and original legacy page remains accessible", async ({ page }) => {
  await page.goto("/not-a-page"); await expect(page.getByRole("heading",{level:1})).toContainText("Let's get you back");
  await page.getByRole("link",{name:"Open workspace",exact:true}).first().click(); await expect(page).toHaveURL(/\/app$/);
  await page.goto("/legacy"); await expect(page.getByRole("button",{name:"Analyze Bid Readiness",exact:true})).toBeVisible();
});
test("navigation, back/forward and theme changes preserve scenario and real entitlements", async ({ page }) => {
  await activate(page); await page.goto("/app/opportunity"); await page.getByRole("button",{name:"Load fictional demo"}).click();
  const baseline=await page.evaluate((key)=>localStorage.getItem(key),STORAGE_KEY), plan=(await snapshot(page)).subscription;
  await page.getByRole("button",{name:"Start what-if scenario"}).click();
  await page.getByRole("article",{name:"Signed product specification sheet",exact:true}).getByLabel("Estimated preparation days").fill("3");
  await page.getByRole("navigation",{name:"Application navigation"}).getByRole("link",{name:"Documents",exact:true}).click();
  await expect(page.getByRole("navigation",{name:"Application navigation"}).getByRole("link",{name:"Documents",exact:true})).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:"Switch to dark mode"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.goBack(); await expect(page.getByRole("region",{name:"What-if comparison"})).toContainText("Action Required");
  await page.goForward(); await expect(page.getByRole("heading",{level:1})).toContainText("Documents & evidence");
  await page.getByRole("navigation",{name:"Application navigation"}).getByRole("link",{name:"Decision brief",exact:true}).click();
  await expect(page.getByRole("region",{name:"Bid decision brief"})).toContainText("HYPOTHETICAL SCENARIO");
  expect(await page.evaluate((key)=>localStorage.getItem(key),STORAGE_KEY)).toBe(baseline);
  expect((await snapshot(page)).subscription).toEqual(plan);
  page.once("dialog",dialog=>dialog.accept());await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(page.getByRole("region",{name:"Bid decision brief"})).toContainText("CURRENT WORKSPACE");
  expect((await snapshot(page)).subscription).toEqual(plan);
});
for (const [timezone, iso, expectedHours] of [["America/New_York","2026-03-08T00:00:00-05:00",23],["America/New_York","2026-11-01T00:00:00-04:00",25],["Asia/Manila","2026-12-31T16:00:00Z",24]] as const) {
  test(`calendar reset respects ${timezone} at ${iso}`, async ({ browser }) => {
    const context=await browser.newContext({timezoneId:timezone});const page=await context.newPage();await page.goto("http://127.0.0.1:4173/");
    const actual=await page.evaluate(async (iso)=>{const path="/lib/subscription.ts",wp="/lib/workspace.ts";const s:typeof import("../lib/subscription.ts")=await import(path);const w:typeof import("../lib/workspace.ts")=await import(wp);const now=new Date(iso);return {hours:(s.nextLocalMidnight(now).getTime()-now.getTime())/3600000,key:w.localDate(now)};},iso);
    expect(actual.hours).toBe(expectedHours);if(timezone==="Asia/Manila")expect(actual.key).toBe("2027-01-01");await context.close();
  });
}
for(const [name,width,height] of [["desktop",1440,1000],["laptop",1024,900],["tablet",820,1180],["mobile",360,800]] as const) test(`${name} layouts remain usable in light and dark themes`,async({page})=>{
  await page.setViewportSize({width,height});
  for(const theme of ["light","dark"]){
    await page.evaluate(theme=>{localStorage.setItem("bidbridge.theme.v1",theme);},theme);
    for(const route of ["/","/pricing","/app/documents","/app/plan"]){
      await page.goto(route); await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      const dimensions = await page.evaluate(() => ({ viewport:innerWidth, document:document.documentElement.scrollWidth }));
      expect(dimensions.document, `${route} in ${theme}: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
      if(route==="/"||route==="/app/documents")await page.screenshot({path:`test-results/commercial-${name}-${theme}-${route==="/"?"home":"documents"}.png`,fullPage:true});
    }
  }
});
