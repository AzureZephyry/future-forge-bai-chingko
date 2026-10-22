import { activatePro, effectivePlan, FREE_SUBSCRIPTION, isSubscription, isUsage, PLAN_CONFIG } from "./subscription.ts";
import type { DailyUploadUsage, SubscriptionState } from "./subscription.ts";
import { localDate } from "./workspace.ts";

export const DATABASE_NAME = "bidbridge.documents.v1";
export const COMMERCIAL_EVENT = "bidbridge-commercial-change";
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((extension) => "." + extension).join(",");
export interface DocumentLink { workspaceId: string | null; requirementId: string | null }
export interface StoredDocument extends DocumentLink { id: string; name: string; mimeType: string; sizeBytes: number; acceptedAt: string }
export interface CommercialSnapshot { subscription: SubscriptionState; usage: DailyUploadUsage; documents: StoredDocument[]; warning: string; quotaError: boolean }
export type Acceptance = { accepted: true; document: StoredDocument } | { accepted: false; name: string; error: string };
type Clock = () => Date;

export function validateFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!FILE_TYPES[extension]) return "Supported formats: PDF, DOCX, TXT, PNG and JPG/JPEG.";
  if (!file.name.trim() || file.name.length > 255) return "File names must contain 1–255 characters.";
  if (file.type && file.type.toLowerCase() !== FILE_TYPES[extension]) return "The file type does not match its extension.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "Empty or invalid files cannot be accepted.";
  if (file.size > PLAN_CONFIG.maxFileBytes) return "Each file must be 10 MB or smaller, on either plan.";
  return null;
}
async function contentError(file: File): Promise<string | null> {
  const type = FILE_TYPES[file.name.split(".").pop()!.toLowerCase()];
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const starts = (expected: number[]) => expected.every((value, i) => bytes[i] === value);
  const valid = type === "text/plain" || (type === "application/pdf" && starts([37,80,68,70,45]))
    || (type === "image/png" && starts([137,80,78,71,13,10,26,10]))
    || (type === "image/jpeg" && starts([255,216,255]))
    || (type?.includes("wordprocessingml") && starts([80,75,3,4]));
  return valid ? null : "The file header does not match its supported format. Choose an original file.";
}
function validDocument(value: unknown): value is StoredDocument {
  if (!value || typeof value !== "object") return false;
  const v = value as StoredDocument;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.acceptedAt === "string"
    && Number.isFinite(Date.parse(v.acceptedAt)) && Object.values(FILE_TYPES).includes(v.mimeType)
    && Number.isSafeInteger(v.sizeBytes) && v.sizeBytes > 0
    && (v.workspaceId === null || typeof v.workspaceId === "string") && (v.requirementId === null || typeof v.requirementId === "string");
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("documents", { keyPath: "id" });
      request.result.createObjectStore("blobs");
      request.result.createObjectStore("usage", { keyPath: "localDateKey" });
      request.result.createObjectStore("settings");
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error("Local document storage is unavailable. No upload was accepted."));
    request.onblocked = () => reject(new Error("Close older BidBridge tabs to open local document storage."));
  });
}
function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(stores, mode);
    const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error("Local storage transaction failed")); tx.onerror = () => {}; });
    void done.catch(() => {});
    try { const value = await work(tx); await done; return value; }
    catch (error) { try { tx.abort(); } catch { /* Already aborted/completed. */ } await done.catch(() => {}); throw error; }
  } finally { db.close(); }
}
function readSubscription(value: unknown): SubscriptionState {
  return isSubscription(value) ? value : { ...FREE_SUBSCRIPTION };
}
function readUsage(value: unknown, key: string): DailyUploadUsage {
  if (value === undefined) return { localDateKey: key, acceptedCount: 0 };
  if (!isUsage(value, key)) throw new Error("Today's upload record is invalid. Free uploads are paused; existing files and preparation tools remain available.");
  return value;
}
export function notifyCommercialChange(): void {
  window.dispatchEvent(new Event(COMMERCIAL_EVENT));
  try { if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(COMMERCIAL_EVENT); channel.postMessage("refresh"); channel.close(); } } catch { /* A notification failure cannot undo a successful commit. */ }
  try { localStorage.setItem(COMMERCIAL_EVENT, crypto.randomUUID()); } catch { /* IndexedDB remains the source of truth. */ }
}
export async function getCommercialSnapshot(now = new Date()): Promise<CommercialSnapshot> {
  return transaction(["documents", "settings", "usage"], "readonly", async (tx) => {
    const [rawPlan, rawUsage, rawDocuments] = await Promise.all([
      requestValue<unknown>(tx.objectStore("settings").get("subscription")),
      requestValue<unknown>(tx.objectStore("usage").get(localDate(now))),
      requestValue<unknown[]>(tx.objectStore("documents").getAll()),
    ]);
    let warning = rawPlan !== undefined && !isSubscription(rawPlan) ? "Saved demo plan was invalid. Free access applies." : "";
    let quotaError = false;
    let usage: DailyUploadUsage;
    try { usage = readUsage(rawUsage, localDate(now)); }
    catch (error) { warning += " " + (error as Error).message; usage = { localDateKey: localDate(now), acceptedCount: PLAN_CONFIG.freeUploads }; quotaError = true; }
    const documents = rawDocuments.filter(validDocument).sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt) || a.id.localeCompare(b.id));
    if (documents.length !== rawDocuments.length) warning += " Some invalid document records could not be listed.";
    return { subscription: readSubscription(rawPlan), usage, documents, warning: warning.trim(), quotaError };
  });
}
/** Blob + metadata + Free usage commit atomically; overlapping tabs serialize this transaction. */
export async function acceptDocument(file: File, link: DocumentLink, clock: Clock = () => new Date()): Promise<Acceptance> {
  const invalid = validateFile(file);
  if (invalid) return { accepted: false, name: file.name, error: invalid };
  try {
    const invalidContent = await contentError(file);
    if (invalidContent) return { accepted: false, name: file.name, error: invalidContent };
    const result = await transaction<Acceptance>(["documents", "blobs", "settings", "usage"], "readwrite", async (tx) => {
      const subscription = readSubscription(await requestValue<unknown>(tx.objectStore("settings").get("subscription")));
      const now = clock(), key = localDate(now);
      const free = effectivePlan(subscription, now) === "free";
      const usage = free ? readUsage(await requestValue<unknown>(tx.objectStore("usage").get(key)), key) : { localDateKey: key, acceptedCount: 0 };
      if (free && usage.acceptedCount >= PLAN_CONFIG.freeUploads) return { accepted: false, name: file.name, error: "Free daily allowance exhausted. Try after local midnight or preview Pro Weekly. Existing files remain accessible." };
      const document: StoredDocument = { ...link, id: crypto.randomUUID(), name: file.name,
        mimeType: FILE_TYPES[file.name.split(".").pop()!.toLowerCase()]!, sizeBytes: file.size, acceptedAt: now.toISOString() };
      await requestValue(tx.objectStore("documents").add(document));
      await requestValue(tx.objectStore("blobs").add(new Blob([file], { type: document.mimeType }), document.id));
      if (free) await requestValue(tx.objectStore("usage").put({ localDateKey: key, acceptedCount: usage.acceptedCount + 1 }));
      return { accepted: true, document };
    });
    if (result.accepted) notifyCommercialChange();
    return result;
  } catch (error) {
    return { accepted: false, name: file.name, error: error instanceof Error && error.message.includes("record is invalid") ? error.message : "Could not save this file locally. Storage may be blocked or full. No allowance was consumed." };
  }
}
export async function acceptDocuments(files: File[], link: DocumentLink, clock?: Clock): Promise<Acceptance[]> {
  const results: Acceptance[] = [];
  for (const file of files) results.push(await acceptDocument(file, link, clock));
  return results;
}
export async function setDemoPlan(pro: boolean, clock: Clock = () => new Date()): Promise<void> {
  await transaction(["settings"], "readwrite", async (tx) => { await requestValue(tx.objectStore("settings").put(pro ? activatePro(clock()) : { ...FREE_SUBSCRIPTION }, "subscription")); });
  notifyCommercialChange();
}
export async function removeDocument(id: string): Promise<void> {
  await transaction(["documents", "blobs"], "readwrite", async (tx) => { await requestValue(tx.objectStore("documents").delete(id)); await requestValue(tx.objectStore("blobs").delete(id)); });
  notifyCommercialChange();
}
export async function associateDocument(id: string, link: DocumentLink): Promise<void> {
  await transaction(["documents"], "readwrite", async (tx) => {
    const document: unknown = await requestValue(tx.objectStore("documents").get(id));
    if (!validDocument(document)) throw new Error("This document is no longer available. Refresh the library.");
    await requestValue(tx.objectStore("documents").put({ ...document, ...link }));
  });
  notifyCommercialChange();
}
export async function getDocumentBlob(id: string): Promise<Blob> {
  return transaction(["blobs"], "readonly", async (tx) => {
    const blob: unknown = await requestValue(tx.objectStore("blobs").get(id));
    if (!(blob instanceof Blob)) throw new Error("This file is no longer available in local storage.");
    return blob;
  });
}
