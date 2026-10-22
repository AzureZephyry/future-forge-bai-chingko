import { test, expect } from "@playwright/test";
import { assessWorkspace, feasibility } from "../../lib/readiness.ts";
import { createDemo } from "../../lib/demo.ts";
import { addCalendarDays, calendarDay, isWorkspace, localDate } from "../../lib/workspace.ts";
import type { BidRequirement, ReadinessStatus, TenderWorkspace } from "../../lib/workspace.ts";

const TODAY = "2026-10-22";
const TIMESTAMP = "2026-10-22T02:00:00.000Z";
function item(status: ReadinessStatus = "unknown", patch: Partial<BidRequirement> = {}): BidRequirement {
  return { id: "requirement", title: "Required document", mandatory: true, status, estimatedDays: null, referencePage: null, notes: "", ...patch };
}
function workspace(requirements: BidRequirement[] = [item()], patch: Partial<TenderWorkspace> = {}): TenderWorkspace {
  return { id: "opportunity", title: "Fictional tender", organization: "Fictional organization", deadline: "2026-10-27", description: "", fictional: true, updatedAt: TIMESTAMP, requirements, ...patch };
}

test("zero requirements is setup, with no completion percentage", () => {
  const result = assessWorkspace(workspace([]), TODAY);
  expect(result.outcome).toBe("setup_required");
  expect(result.readyPercentage).toBeNull();
  expect(result.total).toBe(0);
});

for (const [status, outcome] of [
  ["ready", "ready_for_review"], ["missing", "action_required"], ["claimed", "action_required"],
  ["unknown", "action_required"], ["conflict", "critical_blocker"],
] as const) {
  test(`mandatory ${status} produces ${outcome}`, () => {
    const result = assessWorkspace(workspace([item(status)]), TODAY);
    expect(result.outcome).toBe(outcome);
    expect(result.counts[status]).toBe(1);
    expect(result.outstandingMandatory).toBe(status === "ready" ? 0 : 1);
    expect(result.readyPercentage).toBe(status === "ready" ? 100 : 0);
  });
}

test("optional missing/conflicting gaps remain visible without becoming mandatory blockers", () => {
  const result = assessWorkspace(workspace([
    item("ready", { id: "mandatory" }), item("missing", { id: "optional", mandatory: false, estimatedDays: 8 }),
    item("conflict", { id: "optional-conflict", mandatory: false }),
  ]), TODAY);
  expect(result.outcome).toBe("ready_for_review");
  expect(result.blockers).toEqual([]);
  expect(result.deadlineRisks).toBe(1);
  expect(result.actions).toHaveLength(2);
  expect(result.explanation).toContain("2 optional");
});

test("an optional-only checklist explicitly warns that no mandatory items are designated", () => {
  const result = assessWorkspace(workspace([item("unknown", { mandatory: false })]), TODAY);
  expect(result.explanation).toContain("No mandatory requirements are designated");
  expect(result.outstandingMandatory).toBe(0);
});

test("90 percent completion never hides a mandatory estimate overrun", () => {
  const requirements = Array.from({ length: 9 }, (_, index) => item("ready", { id: "ready-" + index }));
  requirements.push(item("missing", { id: "blocker", estimatedDays: 7 }));
  const result = assessWorkspace(workspace(requirements), TODAY);
  expect(result.readyPercentage).toBe(90);
  expect(result.outcome).toBe("critical_blocker");
  expect(result.blockers[0]!.title).toBe("Required document");
});

for (const [deadline, days, outcome] of [
  ["2026-10-21", -1, "critical_blocker"], ["2026-10-22", 0, "ready_for_review"],
  ["2026-10-23", 1, "ready_for_review"], ["2026-10-01", -21, "critical_blocker"],
] as const) {
  test(`calendar deadline ${deadline}: ${days} days, ${outcome}`, () => {
    const result = assessWorkspace(workspace([item("ready")], { deadline }), TODAY);
    expect(result.remainingDays).toBe(days);
    expect(result.outcome).toBe(outcome);
  });
}

for (const [estimate, state, buffer] of [
  [7, "overrun", -2], [5, "no_buffer", 0], [3, "buffer", 2], [null, "unknown", null], [0, "buffer", 5],
] as const) {
  test(`estimate ${estimate} is ${state}, and never completes a missing item`, () => {
    const requirement = item("missing", { estimatedDays: estimate });
    const result = assessWorkspace(workspace([requirement]), TODAY);
    expect(feasibility(requirement, 5)).toMatchObject({ state, buffer });
    expect(result.counts.missing).toBe(1);
    expect(result.outcome).toBe(state === "overrun" ? "critical_blocker" : "action_required");
  });
}

test("today with a zero-day estimate has no buffer, not an automatic completion", () => {
  const result = assessWorkspace(workspace([item("missing", { estimatedDays: 0 })], { deadline: TODAY }), TODAY);
  expect(result.actions[0]!.feasibility.state).toBe("no_buffer");
  expect(result.outcome).toBe("action_required");
});

test("fractional estimates display readable buffers without floating-point noise", () => {
  expect(feasibility(item("missing", { estimatedDays: 4.9 }), 5).text).toContain("0.1 calendar days");
});

test("already ready items do not receive additional preparation overruns", () => {
  const result = assessWorkspace(workspace([item("ready", { estimatedDays: 100 })]), TODAY);
  expect(result.deadlineRisks).toBe(0);
  expect(result.actions).toEqual([]);
});

test("estimates are individual, not summed or silently scheduled", () => {
  const result = assessWorkspace(workspace([
    item("missing", { id: "a", estimatedDays: 4 }), item("missing", { id: "b", estimatedDays: 4 }),
  ]), TODAY);
  expect(result.deadlineRisks).toBe(0);
  expect(result.actions.map((action) => action.feasibility.buffer)).toEqual([1, 1]);
  expect(result.outcome).toBe("action_required");
});

for (const date of ["", "2026-02-30", "2025-02-29", "2026-13-01", "2026-00-02", "10/22/2026", "2026-1-2", "0000-01-01"]) {
  test(`invalid calendar date rejected: '${date}'`, () => {
    expect(calendarDay(date)).toBeNull();
    const result = assessWorkspace(workspace([item("ready")], { deadline: date }), TODAY);
    expect(result.outcome).toBe("setup_required");
    expect(result.readyPercentage).toBeNull();
  });
}

for (const [start, days, end] of [
  ["2024-02-28", 1, "2024-02-29"], ["2024-02-29", 1, "2024-03-01"],
  ["2025-02-28", 1, "2025-03-01"], ["2026-12-31", 1, "2027-01-01"],
  ["2026-01-31", 1, "2026-02-01"], ["0099-12-31", 1, "0100-01-01"],
  ["2026-03-08", 1, "2026-03-09"],
] as const) {
  test(`calendar boundary ${start} + ${days} = ${end}`, () => {
    expect(addCalendarDays(start, days)).toBe(end);
    expect(calendarDay(end)! - calendarDay(start)!).toBe(days);
  });
}

test("local date uses local date components, without parsing an ISO timestamp as a deadline", () => {
  const date = new Date(2026, 9, 22, 23, 59, 59);
  expect(localDate(date)).toBe(TODAY);
  expect(assessWorkspace(workspace(), "bad-today").outcome).toBe("setup_required");
});

test("action priorities follow mandatory conflict, overrun, missing, unknown, claimed, optional", () => {
  const result = assessWorkspace(workspace([
    item("unknown", { id: "unknown" }), item("claimed", { id: "claimed" }),
    item("missing", { id: "optional", mandatory: false, estimatedDays: 10 }),
    item("missing", { id: "missing-a" }), item("missing", { id: "overrun", estimatedDays: 7 }),
    item("conflict", { id: "conflict" }), item("missing", { id: "missing-b" }), item("ready", { id: "ready" }),
  ]), TODAY);
  expect(result.actions.map((action) => action.id)).toEqual(["conflict", "overrun", "missing-a", "missing-b", "unknown", "claimed", "optional"]);
  expect(result.actions.every((action) => action.recommendation.length > 15 && action.reason.length > 15)).toBe(true);
});

test("demo recalculates risk without confusing a shorter estimate with readiness", () => {
  const demo = createDemo(TODAY, "demo", TIMESTAMP);
  expect(assessWorkspace(demo, TODAY)).toMatchObject({ remainingDays: 5, outcome: "critical_blocker", outstandingMandatory: 3 });
  const specification = demo.requirements.find((requirement) => requirement.id === "demo-specification")!;
  specification.estimatedDays = 3;
  expect(assessWorkspace(demo, TODAY)).toMatchObject({ outcome: "action_required", outstandingMandatory: 3, deadlineRisks: 0 });
  specification.status = "ready";
  expect(assessWorkspace(demo, TODAY).outstandingMandatory).toBe(2);
  demo.requirements.filter((requirement) => requirement.mandatory).forEach((requirement) => { requirement.status = "ready"; });
  expect(assessWorkspace(demo, TODAY).outcome).toBe("ready_for_review");
  expect(assessWorkspace(demo, TODAY).actions).toHaveLength(1);
});

test("calculation is deterministic and does not mutate frozen input", () => {
  const data = workspace([Object.freeze(item("missing", { estimatedDays: 7 }))]);
  Object.freeze(data.requirements); Object.freeze(data);
  const first = assessWorkspace(data, TODAY);
  expect(assessWorkspace(data, TODAY)).toEqual(first);
  expect(data.requirements[0]!.status).toBe("missing");
});

for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
  test(`invalid preparation estimate ${invalid} cannot produce a business conclusion`, () => {
    const data = workspace([item("ready", { estimatedDays: invalid })]);
    expect(isWorkspace(data)).toBe(false);
    expect(assessWorkspace(data, TODAY).readyPercentage).toBeNull();
  });
}
