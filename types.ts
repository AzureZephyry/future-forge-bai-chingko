// Mirrors the agreed API contract. If Christan changes the schema, update ONLY this file first.

export type Availability = "available" | "not_available" | "unknown";

export interface SupplierProfile {
  business_name: string;
  industry: string;
  business_permit: Availability;
  registration: Availability;
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
  page: number;
  chunk_id: string;
  excerpt: string;
}

export interface Requirement {
  id: string;
  requirement: string;
  status: RequirementStatus;
  reason: string;
  next_action: string;
  source: SourceRef;
}

export interface TenderInfo {
  title: string;
  deadline: string | null;
}

export interface AnalysisResponse {
  tender: TenderInfo;
  requirements: Requirement[];
  overall: OverallOutcome;
}
