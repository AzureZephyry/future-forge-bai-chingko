import { test, expect } from "@playwright/test";
import { activatePro, effectivePlan, FREE_SUBSCRIPTION, isSubscription, isUsage, nextLocalMidnight, nextRefreshAt, PLAN_CONFIG, remainingUploads } from "../../lib/subscription.ts";
import { localDate } from "../../lib/workspace.ts";
import { validateFile } from "../../lib/documents.ts";

const now = new Date(2026, 9, 22, 14, 0, 0);
const key = localDate(now);
for (const count of [0, 1, 2, 3]) test(`Free usage ${count} leaves ${3-count} uploads`, () => {
  expect(remainingUploads({ localDateKey: key, acceptedCount: count }, FREE_SUBSCRIPTION, now)).toBe(3-count);
});
test("same-day usage remains consumed until local midnight", () => {
  const usage = { localDateKey: key, acceptedCount: 2 };
  expect(remainingUploads(usage, FREE_SUBSCRIPTION, new Date(2026, 9, 22, 23, 59, 59))).toBe(1);
  expect(remainingUploads(usage, FREE_SUBSCRIPTION, new Date(2026, 9, 23))).toBe(3);
});
test("a new local date restores allowance even when fewer than 24 hours passed", () => {
  const before = new Date(2026, 9, 22, 23, 58);
  const next = new Date(2026, 9, 23);
  expect(next.getTime() - before.getTime()).toBe(2*60*1000);
  expect(remainingUploads({ localDateKey: localDate(before), acceptedCount: 3 }, FREE_SUBSCRIPTION, next)).toBe(3);
});
for (const [year, month, day, nextYear, nextMonth, nextDay] of [[2026,11,31,2027,0,1], [2028,1,28,2028,1,29], [2028,1,29,2028,2,1], [2026,3,30,2026,4,1]]) {
  test(`next local midnight handles ${year}-${month+1}-${day}`, () => {
    const next = nextLocalMidnight(new Date(year, month, day, 18));
    expect([next.getFullYear(),next.getMonth(),next.getDate(),next.getHours(),next.getMinutes()]).toEqual([nextYear,nextMonth,nextDay,0,0]);
  });
}
test("Pro duration is exactly 168 absolute hours", () => {
  const pro = activatePro(now);
  expect(isSubscription(pro)).toBe(true);
  expect(Date.parse(pro.expiresAt!) - Date.parse(pro.activatedAt!)).toBe(168*60*60*1000);
  expect(pro.demoOnly).toBe(true);
});
test("Pro remains active until the exact expiry boundary, with no automatic renewal", () => {
  const pro = activatePro(now), expiry = Date.parse(pro.expiresAt!);
  expect(effectivePlan(pro, now)).toBe("pro_weekly");
  expect(effectivePlan(pro, new Date(expiry-1))).toBe("pro_weekly");
  expect(effectivePlan(pro, new Date(expiry))).toBe("free");
  expect(effectivePlan(pro, new Date(expiry+1))).toBe("free");
});
test("future-dated activation is not active", () => { expect(effectivePlan(activatePro(now), new Date(now.getTime()-1))).toBe("free"); });
test("active Pro has no numerical quota but expiry respects same-day Free consumption", () => {
  const start = new Date(now.getTime()-167*3600000), pro = activatePro(start);
  const usage = { localDateKey: key, acceptedCount: 3 };
  expect(remainingUploads(usage, pro, now)).toBeNull();
  expect(remainingUploads(usage, pro, new Date(Date.parse(pro.expiresAt!)))).toBe(0);
});
test("explicit restart begins a fresh seven days from the new activation", () => {
  const first = activatePro(now), restarted = activatePro(new Date(now.getTime()+3600000));
  expect(Date.parse(restarted.expiresAt!) - Date.parse(first.expiresAt!)).toBe(3600000);
});
test("refresh deadline chooses expiry before midnight or a minute tick", () => {
  const expiry = new Date(now.getTime()+5000);
  const pro = activatePro(new Date(expiry.getTime()-168*3600000));
  expect(nextRefreshAt(now, pro)).toBe(expiry.getTime());
  const late = new Date(2026,9,22,23,59,59);
  expect(nextRefreshAt(late, FREE_SUBSCRIPTION)).toBe(nextLocalMidnight(late).getTime());
});
for (const bad of [null, {}, { plan: "pro_weekly", demoOnly: false }, { ...activatePro(now), expiresAt: "invalid" }, { ...activatePro(now), expiresAt: now.toISOString() }, { ...FREE_SUBSCRIPTION, token: "unsupported" }]) {
  test(`malformed subscription is rejected: ${JSON.stringify(bad)}`, () => { expect(isSubscription(bad)).toBe(false); });
}
for (const count of [-1, 1.5, 4, Number.NaN]) test(`malformed quota is rejected: ${count}`, () => {
  expect(isUsage({ localDateKey: key, acceptedCount: count }, key)).toBe(false);
});
test("quota calculation is pure and does not rewrite a previous day's usage", () => {
  const usage = Object.freeze({ localDateKey: "2026-10-21", acceptedCount: 3 });
  expect(remainingUploads(usage, Object.freeze({ ...FREE_SUBSCRIPTION }), now)).toBe(3);
  expect(usage.acceptedCount).toBe(3);
});
for (const [name, type] of [["permit.pdf","application/pdf"],["photo.PNG","image/png"],["notes.txt","text/plain"],["scope.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],["photo.jpeg","image/jpeg"],["image.jpg",""]]) test(`supported file validation: ${name}`, () => {
  expect(validateFile({ name, type, size: 20 })).toBeNull();
});
for (const [name, type, size] of [["script.html","text/html",20],["photo.svg","image/svg+xml",20],["fake.pdf","text/html",20],["empty.txt","text/plain",0],["large.pdf","application/pdf",PLAN_CONFIG.maxFileBytes+1]] as const) test(`file rejected without acceptance: ${name}`, () => {
  expect(validateFile({ name, type, size })).not.toBeNull();
});
test("per-file cap accepts its exact boundary for both plans", () => { expect(validateFile({ name:"file.txt",type:"text/plain",size:PLAN_CONFIG.maxFileBytes })).toBeNull(); });
