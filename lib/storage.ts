import { isWorkspace } from "./workspace.ts";
import type { TenderWorkspace } from "./workspace.ts";

export const STORAGE_KEY = "bidbridge.workspace.v1";
export interface WorkspaceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type LoadResult = { state: "loaded"; workspace: TenderWorkspace; message: string }
  | { state: "empty" | "invalid" | "unavailable"; workspace: null; message: string };

export function loadWorkspace(storage: WorkspaceStorage): LoadResult {
  let raw: string | null;
  try { raw = storage.getItem(STORAGE_KEY); }
  catch { return { state: "unavailable", workspace: null, message: "Browser storage is unavailable. Changes can only remain in this session." }; }
  if (raw === null) return { state: "empty", workspace: null, message: "No saved workspace yet." };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("version" in data) || !("workspace" in data)
      || Object.keys(data).length !== 2 || data.version !== 1 || !isWorkspace(data.workspace)) throw new Error("Unsupported data");
    return { state: "loaded", workspace: data.workspace, message: "Restored from this browser." };
  } catch {
    return { state: "invalid", workspace: null, message: "Saved data is corrupt or uses an unsupported schema. It has not been overwritten. Create a workspace or load the demo to replace it intentionally." };
  }
}

export function saveWorkspace(storage: WorkspaceStorage, workspace: TenderWorkspace): { ok: boolean; message: string } {
  if (!isWorkspace(workspace)) return { ok: false, message: "Invalid draft — not saved. Correct the fields; the last valid saved workspace is retained." };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspace }));
    return { ok: true, message: "Saved locally in this browser" };
  } catch { return { ok: false, message: "Unable to save locally. Keep this tab open; changes may be lost on refresh." }; }
}
