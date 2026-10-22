import { addCalendarDays } from "./workspace.ts";
import type { TenderWorkspace } from "./workspace.ts";

export function createDemo(today: string, id: string, updatedAt: string): TenderWorkspace {
  return {
    id, title: "Office Supplies Procurement — Demonstration", organization: "Fictional Cebu Procurement Office",
    deadline: addCalendarDays(today, 5), fictional: true, updatedAt,
    description: "Fictional planning example for Sample Cebu Trading. These editable requirements and estimates are illustrative, not government eligibility rules or real processing times.",
    requirements: [
      { id: "demo-permit", title: "Business permit", mandatory: true, status: "ready", estimatedDays: 0, referencePage: 2, notes: "Demo supplier reports its supporting copy is prepared." },
      { id: "demo-registration", title: "Supplier registration", mandatory: true, status: "claimed", estimatedDays: 1, referencePage: 2, notes: "Supporting documentation has not been confirmed." },
      { id: "demo-specification", title: "Signed product specification sheet", mandatory: true, status: "missing", estimatedDays: 7, referencePage: 3, notes: "Seven days is the fictional supplier's estimate, not an agency turnaround promise." },
      { id: "demo-delivery", title: "Delivery commitment", mandatory: true, status: "unknown", estimatedDays: null, referencePage: 4, notes: "Confirm the supplier's delivery commitment." },
      { id: "demo-samples", title: "Product samples", mandatory: false, status: "ready", estimatedDays: 0, referencePage: null, notes: "Optional illustrative item." },
      { id: "demo-record", title: "Additional supporting record", mandatory: false, status: "missing", estimatedDays: 2, referencePage: null, notes: "Optional illustrative item; never a mandatory blocker." },
    ],
  };
}
