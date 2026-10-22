import type { RequirementStatus } from "../types";

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  documented_match: "Documented match",
  self_reported_match: "Self-reported (not verified)",
  missing: "Missing",
  unknown: "Unknown",
  conflict: "Conflict",
};

export function StatusBadge({ status }: { status: RequirementStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}
