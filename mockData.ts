// MOCK DATA ONLY. Not produced by the backend, ALMA, or a real tender.
// Delete this file's usage in api.ts once /api/analyze is connected.

import type { AnalysisResponse, SupplierProfile } from "./types";

export function buildMockResponse(profile: SupplierProfile): AnalysisResponse {
  const registered = profile.registration === "available";
  const permitted = profile.business_permit === "available";

  return {
    tender: { title: "MOCK: Sample Procurement of Office Supplies", deadline: null },
    requirements: [
      {
        id: "R1",
        requirement: "Valid business registration",
        status: registered ? "self_reported_match" : "unknown",
        reason: registered
          ? "Supplier says it is registered. No supporting document was provided."
          : "Supplier information is insufficient.",
        next_action: registered ? "Prepare registration document" : "Confirm registration status",
        source: {
          document: "mock_tender.pdf",
          page: 3,
          chunk_id: "p3-c1",
          excerpt: "Bidders must submit a valid business registration (mock text).",
        },
      },
      {
        id: "R2",
        requirement: "Business or mayor's permit",
        status: permitted ? "self_reported_match" : "missing",
        reason: permitted
          ? "Supplier says a permit is available. Not verified."
          : "Supplier reports no permit.",
        next_action: permitted ? "Prepare permit copy" : "Prepare missing permit",
        source: {
          document: "mock_tender.pdf",
          page: 3,
          chunk_id: "p3-c2",
          excerpt: "A current business permit shall be attached to the bid (mock text).",
        },
      },
      {
        id: "R3",
        requirement: "Delivery within the required period",
        status: "unknown",
        reason: "The delivery period in the tender is unclear.",
        next_action: "Seek clarification from the procuring entity",
        source: {
          document: "mock_tender.pdf",
          page: 7,
          chunk_id: "p7-c4",
          excerpt: "Delivery shall be made within the period stated in the contract (mock text).",
        },
      },
    ],
    overall: registered && permitted ? "needs_review" : "pause",
  };
}
