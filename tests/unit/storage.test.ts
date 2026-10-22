import { test, expect } from "@playwright/test";
import { createDemo } from "../../lib/demo.ts";
import { loadWorkspace, saveWorkspace, STORAGE_KEY } from "../../lib/storage.ts";
import type { WorkspaceStorage } from "../../lib/storage.ts";
import { isWorkspace, requirementErrors } from "../../lib/workspace.ts";

const demo = () => createDemo("2026-10-22", "workspace-id", "2026-10-22T02:00:00.000Z");
function storage(initial: string | null = null): WorkspaceStorage {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

test("missing storage initializes an empty workspace", () => expect(loadWorkspace(storage())).toMatchObject({ state: "empty", workspace: null }));
test("workspace saves and restores every field and stable requirement ID", () => {
  const store = storage();
  const original = demo();
  expect(saveWorkspace(store, original).ok).toBe(true);
  expect(loadWorkspace(store)).toMatchObject({ state: "loaded", workspace: original });
  expect(JSON.parse(store.getItem(STORAGE_KEY)!).version).toBe(1);
});

for (const raw of ["not JSON", "null", "[]", '{"version":2,"workspace":{}}', '{"version":1}', '{"version":1,"workspace":null}']) {
  test(`corrupt or unsupported storage is rejected, without overwriting: ${raw}`, () => {
    const store = storage(raw);
    expect(loadWorkspace(store)).toMatchObject({ state: "invalid", workspace: null });
    expect(store.getItem(STORAGE_KEY)).toBe(raw);
  });
}

test("invalid edits cannot overwrite the last saved valid workspace", () => {
  const store = storage(); const data = demo();
  saveWorkspace(store, data);
  data.title = " ";
  expect(saveWorkspace(store, data).ok).toBe(false);
  expect(loadWorkspace(store)).toMatchObject({ workspace: { title: "Office Supplies Procurement — Demonstration" } });
});

test("storage exceptions are explicit, never a successful save", () => {
  const store = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Quota"); } };
  expect(loadWorkspace(store).state).toBe("unavailable");
  expect(saveWorkspace(store, demo())).toMatchObject({ ok: false });
});

for (const change of [
  { title: " " }, { mandatory: "true" }, { status: "verified" },
  { referencePage: 0 }, { referencePage: 1.5 }, { referencePage: true },
  { estimatedDays: "3" }, { estimatedDays: -1 }, { notes: null }, { invented: "field" },
]) {
  test(`strict requirement validation: ${JSON.stringify(change)}`, () => {
    const data = demo(); Object.assign(data.requirements[0]!, change);
    expect(isWorkspace(data)).toBe(false);
    expect(requirementErrors(data.requirements[0])).not.toEqual([]);
  });
}

test("duplicate IDs and invalid timestamps are rejected safely on restore", () => {
  const data = demo(); data.requirements[1]!.id = data.requirements[0]!.id;
  expect(isWorkspace(data)).toBe(false);
  expect(loadWorkspace(storage(JSON.stringify({ version: 1, workspace: data }))).state).toBe("invalid");
  const other = demo(); other.updatedAt = "2026-02-30T02:00:00.000Z";
  expect(isWorkspace(other)).toBe(false);
});
