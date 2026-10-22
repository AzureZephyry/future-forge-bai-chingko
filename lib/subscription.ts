import { calendarDay, localDate } from "./workspace.ts";

export const PLAN_CONFIG = Object.freeze({ freeUploads: 3, weeklyPricePHP: 99, durationHours: 168, maxFileBytes: 10 * 1024 * 1024 });
export const DEMO_NOTICE = "Subscription and upload allowances are simulated in this prototype. No payment is processed.";
export const PRICE_NOTICE = "Illustrative demo pricing. Subject to customer validation. No payment is collected.";
export type PlanType = "free" | "pro_weekly";
export interface SubscriptionState { plan: PlanType; activatedAt: string | null; expiresAt: string | null; demoOnly: true }
export interface DailyUploadUsage { localDateKey: string; acceptedCount: number }
export const FREE_SUBSCRIPTION: SubscriptionState = { plan: "free", activatedAt: null, expiresAt: null, demoOnly: true };
const duration = PLAN_CONFIG.durationHours * 60 * 60 * 1000;

function iso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function isSubscription(value: unknown): value is SubscriptionState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 4 || v.demoOnly !== true) return false;
  if (v.plan === "free") return v.activatedAt === null && v.expiresAt === null;
  return v.plan === "pro_weekly" && iso(v.activatedAt) && iso(v.expiresAt)
    && Date.parse(v.expiresAt) - Date.parse(v.activatedAt) === duration;
}
export function activatePro(now: Date): SubscriptionState {
  return { plan: "pro_weekly", activatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + duration).toISOString(), demoOnly: true };
}
export function effectivePlan(subscription: SubscriptionState, now: Date): PlanType {
  return isSubscription(subscription) && subscription.plan === "pro_weekly"
    && Date.parse(subscription.activatedAt!) <= now.getTime() && now.getTime() < Date.parse(subscription.expiresAt!) ? "pro_weekly" : "free";
}
export function isUsage(value: unknown, key: string): value is DailyUploadUsage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && v.localDateKey === key && calendarDay(key) !== null
    && Number.isInteger(v.acceptedCount) && Number(v.acceptedCount) >= 0 && Number(v.acceptedCount) <= PLAN_CONFIG.freeUploads;
}
export function remainingUploads(usage: DailyUploadUsage, subscription: SubscriptionState, now: Date): number | null {
  if (effectivePlan(subscription, now) === "pro_weekly") return null;
  if (!isUsage(usage, usage.localDateKey)) throw new Error("Invalid daily upload usage");
  return PLAN_CONFIG.freeUploads - (usage.localDateKey === localDate(now) ? usage.acceptedCount : 0);
}
/** Local calendar construction respects 23/25-hour days; never a fixed 24-hour interval. */
export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}
export function nextRefreshAt(now: Date, subscription: SubscriptionState): number {
  const expiry = effectivePlan(subscription, now) === "pro_weekly" ? Date.parse(subscription.expiresAt!) : Infinity;
  return Math.min(nextLocalMidnight(now).getTime(), expiry, now.getTime() + 60_000);
}
export function formatLocalTime(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long" }).format(new Date(value));
}
export function accessRemaining(subscription: SubscriptionState, now: Date): string {
  if (effectivePlan(subscription, now) === "free") return "No active Pro period";
  const minutes = Math.ceil((Date.parse(subscription.expiresAt!) - now.getTime()) / 60_000);
  return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h ${minutes % 60}m remaining`;
}
