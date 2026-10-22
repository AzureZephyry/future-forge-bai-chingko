import type { AnalysisResponse, SupplierProfile, SourceRef } from "./types";
import { isProfileReady, validateFile } from "./validation";

// This label never changes request behavior. All assessments come from the backend.
export const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === "true";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const INVALID_RESPONSE = "The server returned an unsupported assessment. Please retry or ask the team to check the API connection.";

const HTTP_ERRORS: Record<number, string> = {
  413: "Choose a PDF no larger than 15 MiB.",
  415: "The uploaded file is not a PDF. Choose a text-based PDF.",
  422: "Check your supplier details and upload a readable, text-based PDF. The server could not validate the input or find relevant evidence.",
  503: "Analysis is unavailable because retrieval or AI inference is not configured. Your inputs are kept so you can retry.",
  502: "The assessment service could not produce a valid result. Your inputs are kept; please try again.",
  500: "The server could not process the tender. Please retry or ask the team to check the service.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSource(value: unknown): value is SourceRef {
  return isRecord(value) && typeof value.document === "string"
    && typeof value.chunk_id === "string" && typeof value.excerpt === "string"
    && (value.page === null || (typeof value.page === "number" && Number.isInteger(value.page) && value.page >= 1));
}

function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (!isRecord(value) || !isRecord(value.tender) || typeof value.uncertainty !== "string"
    || !["consider", "needs_review", "pause"].includes(String(value.overall))
    || !(value.tender.title === null || typeof value.tender.title === "string")
    || !(value.tender.deadline === null || typeof value.tender.deadline === "string")
    || !Array.isArray(value.requirements)) return false;
  return value.requirements.every((item: unknown) => isRecord(item)
    && ["id", "requirement", "reason", "next_action"].every((key) => typeof item[key] === "string")
    && ["documented_match", "self_reported_match", "missing", "unknown", "conflict"].includes(String(item.status))
    && (item.source === null || isSource(item.source))
    && Array.isArray(item.sources) && item.sources.every(isSource));
}

export async function analyze(
  tenderFile: File,
  profile: SupplierProfile,
): Promise<AnalysisResponse> {
  const fileError = validateFile(tenderFile);
  if (fileError) throw new Error(fileError);
  if (!isProfileReady(profile)) throw new Error("Complete every supplier field. Use 'unknown' when information is unavailable.");

  const formData = new FormData();
  formData.append("tender_file", tenderFile);
  formData.append("supplier_profile", JSON.stringify({
    business_name: profile.business_name.trim(),
    industry: profile.industry.trim(),
    business_permit: profile.business_permit.trim(),
    registration: profile.registration.trim(),
    delivery_capacity: profile.delivery_capacity.trim(),
  }));

  // The browser sets the multipart Content-Type header itself.
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/analyze`, { method: "POST", body: formData });
  } catch {
    throw new Error("Cannot reach the backend. Check the API connection and try again; your inputs are kept.");
  }

  if (!res.ok) {
    throw new Error(HTTP_ERRORS[res.status] ?? `The request failed (HTTP ${res.status}). Please try again.`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(INVALID_RESPONSE);
  }
  if (!isAnalysisResponse(body)) throw new Error(INVALID_RESPONSE);
  return body;
}
