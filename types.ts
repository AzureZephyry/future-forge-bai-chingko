// Public HTTP schema in backend/app/schemas/assessment.py (not the internal AI schema).

export type Availability = "available" | "not_available" | "unknown";

export interface SupplierProfile {
  business_name: string;
  industry: string;
  business_permit: string;
  registration: string;
  delivery_capacity: string;
}

export type RequirementStatus =
  | "documented_match"
  | "self_reported_match"
  | "missing"
  | "unknown"
  | "conflict";

export type OverallOutcome = "consider" | "needs_review" | "pause";

export interface SourceRef {
  document: string;
  page: number | null;
  chunk_id: string;
  excerpt: string;
}

export interface Requirement {
  id: string;
  requirement: string;
  status: RequirementStatus;
  reason: string;
  next_action: string;
  source: SourceRef | null;
  sources: SourceRef[];
}

export interface TenderInfo {
  title: string | null;
  deadline: string | null;
}

export interface AnalysisResponse {
  tender: TenderInfo;
  requirements: Requirement[];
  overall: OverallOutcome;
  uncertainty: string;
}
