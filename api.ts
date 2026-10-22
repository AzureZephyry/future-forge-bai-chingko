import type { AnalysisResponse, SupplierProfile } from "./types";
import { buildMockResponse } from "./mockData";

// Set VITE_USE_MOCK=true in frontend/.env.local to run without the backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export async function analyze(
  tenderFile: File,
  profile: SupplierProfile,
): Promise<AnalysisResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return buildMockResponse(profile);
  }

  const formData = new FormData();
  formData.append("tender_file", tenderFile);
  formData.append("supplier_profile", JSON.stringify(profile));

  // The browser sets the multipart Content-Type header itself.
  const res = await fetch("/api/analyze", { method: "POST", body: formData });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // response was not JSON; keep the default message
    }
    throw new Error(detail);
  }
  return (await res.json()) as AnalysisResponse;
}
