import { calendarDay, workspaceErrors } from "./workspace.ts";
import type { BidRequirement, ReadinessStatus, TenderWorkspace } from "./workspace.ts";

export type Advisory = "setup_required" | "critical_blocker" | "action_required" | "ready_for_review";
export const ADVISORY_LABELS: Record<Advisory, string> = {
  setup_required: "Setup Required", critical_blocker: "Critical Blocker",
  action_required: "Action Required", ready_for_review: "Ready for Review",
};
export const DISCLAIMER = "Preparation guidance only. User-entered statuses and estimates are not independently verified. This is not official eligibility, legal-compliance certification, or a guarantee of bidding success.";
export const ESTIMATE_NOTE = "Estimates are assessed individually, using calendar days. Task dependencies, processing times, and an overall completion date are not inferred.";

export interface Feasibility {
  state: "ready" | "unknown" | "overrun" | "no_buffer" | "buffer" | "past_deadline";
  buffer: number | null;
  text: string;
}
export interface PreparationAction {
  id: string;
  title: string;
  status: ReadinessStatus;
  mandatory: boolean;
  priority: number;
  recommendation: string;
  reason: string;
  feasibility: Feasibility;
}
export interface Blocker { id: string; title: string; reason: string }
export interface ReadinessAssessment {
  total: number;
  mandatory: number;
  counts: Record<ReadinessStatus, number>;
  outstandingMandatory: number;
  unresolved: number;
  deadlineRisks: number;
  remainingDays: number | null;
  readyPercentage: number | null;
  outcome: Advisory;
  explanation: string;
  blockers: Blocker[];
  actions: PreparationAction[];
  errors: string[];
}

export function feasibility(item: BidRequirement, remainingDays: number): Feasibility {
  if (item.status === "ready") return { state: "ready", buffer: null, text: "Recorded as prepared; no additional preparation is assessed." };
  if (remainingDays < 0) return { state: "past_deadline", buffer: null, text: "The submission date has passed. Confirm whether the opportunity is still open." };
  if (item.estimatedDays === null) return { state: "unknown", buffer: null, text: "No preparation estimate entered; deadline feasibility is unknown." };
  const buffer = remainingDays - item.estimatedDays;
  const displayedBuffer = Number(Math.abs(buffer).toPrecision(8));
  if (buffer < 0) return { state: "overrun", buffer, text: `Your ${item.estimatedDays}-day estimate exceeds the ${remainingDays}-day window by ${displayedBuffer} calendar days.` };
  if (buffer === 0) return { state: "no_buffer", buffer, text: `Your ${item.estimatedDays}-day estimate leaves no remaining calendar-day buffer.` };
  return { state: "buffer", buffer, text: `Under your ${item.estimatedDays}-day estimate, ${displayedBuffer} calendar days of buffer remain. This is not a completion guarantee.` };
}

/** Pure: today is an explicit local YYYY-MM-DD date; no network, React or mutation. */
export function assessWorkspace(workspace: TenderWorkspace, today: string): ReadinessAssessment {
  const errors = workspaceErrors(workspace);
  const current = calendarDay(today);
  if (current === null) errors.push("The current local calendar date is invalid.");
  const counts: Record<ReadinessStatus, number> = { ready: 0, claimed: 0, missing: 0, unknown: 0, conflict: 0 };
  if (errors.length) return {
    total: Array.isArray(workspace.requirements) ? workspace.requirements.length : 0, mandatory: 0, counts, outstandingMandatory: 0,
    unresolved: 0, deadlineRisks: 0, remainingDays: null, readyPercentage: null,
    outcome: "setup_required", explanation: "Correct the invalid draft fields before assessing preparation. The last valid saved workspace is retained.",
    blockers: [], actions: [], errors,
  };
  const remainingDays = calendarDay(workspace.deadline)! - current!;
  const items = workspace.requirements;
  for (const item of items) counts[item.status] += 1;
  const mandatory = items.filter((item) => item.mandatory).length;
  const outstandingMandatory = items.filter((item) => item.mandatory && item.status !== "ready").length;
  const blockers: Blocker[] = [];
  if (remainingDays < 0) blockers.push({ id: "deadline", title: "Submission date passed", reason: `${Math.abs(remainingDays)} calendar days past the entered deadline.` });
  const actions: PreparationAction[] = [];
  let deadlineRisks = 0;
  for (const item of items) {
    if (item.status === "ready") continue;
    const timing = feasibility(item, remainingDays);
    if (timing.state === "overrun" || timing.state === "past_deadline") deadlineRisks += 1;
    if (item.mandatory && item.status === "conflict") blockers.push({ id: `conflict:${item.id}`, title: item.title, reason: "A mandatory requirement has an explicit recorded conflict." });
    if (item.mandatory && timing.state === "overrun") blockers.push({ id: `estimate:${item.id}`, title: item.title, reason: timing.text });
    const priority = !item.mandatory ? 6 : item.status === "conflict" ? 1 : timing.state === "overrun" ? 2 : item.status === "missing" ? 3 : item.status === "unknown" ? 4 : 5;
    const recommendations: Record<Exclude<ReadinessStatus, "ready">, string> = {
      conflict: `Review and resolve the conflict affecting ${item.title}.`,
      missing: `Prepare or obtain ${item.title}.`,
      unknown: `Verify the status and supporting information for ${item.title}.`,
      claimed: `Locate or confirm supporting evidence for ${item.title}.`,
    };
    const reasons = ["", "Mandatory conflict: resolve incompatible information first.", "Mandatory preparation estimate exceeds the submission window.", "Explicitly missing mandatory preparation item.", "Mandatory status is unknown; information must be checked.", "Mandatory claim lacks confirmed supporting documentation.", "Optional outstanding item; visible but not a mandatory blocker."];
    actions.push({ id: item.id, title: item.title, status: item.status, mandatory: item.mandatory, priority,
      recommendation: recommendations[item.status] + (timing.state === "overrun" ? " Review whether completion before the deadline is realistic." : ""),
      reason: reasons[priority]!, feasibility: timing });
  }
  // Stable sort preserves recorded order for ties, rather than claiming optimized scheduling.
  actions.sort((left, right) => left.priority - right.priority);
  const outcome: Advisory = items.length === 0 ? "setup_required" : blockers.length > 0 ? "critical_blocker" : outstandingMandatory > 0 ? "action_required" : "ready_for_review";
  const optionalGaps = actions.filter((item) => !item.mandatory).length;
  const explanations: Record<Advisory, string> = {
    setup_required: "Record the tender's requirements before drawing a readiness conclusion. An empty checklist is not complete preparation.",
    critical_blocker: "A passed deadline, mandatory conflict, or mandatory estimate overrun requires attention. Recorded completion does not override these blockers.",
    action_required: `${outstandingMandatory} mandatory requirement${outstandingMandatory === 1 ? " remains" : "s remain"} unresolved. A shorter estimate does not make an item ready.`,
    ready_for_review: `${mandatory === 0 ? "No mandatory requirements are designated; check the tender for completeness." : "All recorded mandatory requirements are marked ready."} ${optionalGaps > 0 ? `${optionalGaps} optional item(s) remain unresolved.` : "Review your checklist and supporting records before deciding how to proceed."}`,
  };
  return {
    total: items.length, mandatory, counts, outstandingMandatory,
    unresolved: items.length - counts.ready, deadlineRisks, remainingDays,
    readyPercentage: items.length ? Math.round(counts.ready / items.length * 100) : null,
    outcome, explanation: explanations[outcome], blockers, actions, errors,
  };
}
