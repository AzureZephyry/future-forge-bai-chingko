import type { RequirementStatus } from "../types";

const LABELS: Record<RequirementStatus, string> = {
  documented_match: "Documented match",
  self_reported_match: "Self-reported (not verified)",
  missing: "Missing",
  unknown: "Unknown",
  conflict: "Conflict",
};

export function StatusBadge({ status }: { status: RequirementStatus }) {
  return <span className={`badge badge--${status}`}>{LABELS[status]}</span>;
}
