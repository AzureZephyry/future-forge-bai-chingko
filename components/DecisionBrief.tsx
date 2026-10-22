import { ADVISORY_LABELS, DISCLAIMER, ESTIMATE_NOTE } from "../lib/readiness.ts";
import type { ReadinessAssessment } from "../lib/readiness.ts";
import { STATUS_COPY } from "../lib/workspace.ts";
import type { TenderWorkspace } from "../lib/workspace.ts";

export function DecisionBrief({ workspace, assessment, today, hypothetical, onClose }: {
  workspace: TenderWorkspace;
  assessment: ReadinessAssessment;
  today: string;
  hypothetical: boolean;
  onClose: () => void;
}) {
  return <section className="panel workspace-wide decision-brief" aria-label="Bid decision brief">
    <div className="brief-controls button-row"><button className="primary-button" type="button" onClick={() => window.print()}>Print decision brief</button><button className="secondary-button" type="button" onClick={onClose}>Close brief</button></div>
    <p className="results__eyebrow">BidBridge · Know Before You Bid.</p><h2>Bid decision brief</h2>
    <p className="brief-context"><strong>{hypothetical ? "HYPOTHETICAL SCENARIO — not saved or completed work" : "CURRENT WORKSPACE — user-reported preparation"}</strong></p>
    {workspace.fictional && <p className="fictional-label">FICTIONAL DEMONSTRATION</p>}
    <h3>{workspace.title}</h3><p>{workspace.organization} · Submission date: {workspace.deadline}</p>
    <p>Assessment date (local calendar): {today} · {assessment.remainingDays} calendar days remaining</p>
    <p><strong>{ADVISORY_LABELS[assessment.outcome]}</strong> — {assessment.explanation}</p>
    <p>{assessment.total} requirements · {assessment.mandatory} mandatory · {assessment.counts.ready} ready · {assessment.outstandingMandatory} unresolved mandatory · {assessment.deadlineRisks} deadline risks</p>
    <h3>Mandatory / deadline blockers</h3>
    {assessment.blockers.length ? <ul>{assessment.blockers.map((item) => <li key={item.id}><strong>{item.title}:</strong> {item.reason}</li>)}</ul> : <p>No critical blockers identified from the recorded information.</p>}
    <h3>Recorded requirements</h3>
    <div className="brief-requirements">{workspace.requirements.map((item) => <div className="brief-requirement" key={item.id}>
      <strong>{item.title}</strong><p>{item.mandatory ? "Mandatory" : "Optional"} · {STATUS_COPY[item.status].label} · Preparation estimate: {item.estimatedDays === null ? "unknown" : item.estimatedDays + " calendar days"} · Reference page: {item.referencePage ?? "not entered"}</p>
    </div>)}</div>
    <p className="hint">Statuses, estimates and page references are entered by the user. BidBridge has not inspected supporting documents. Ready means you report the item prepared and supporting evidence available; Claimed lacks confirmed supporting documentation.</p>
    <h3>Prioritized Gap-to-Go actions</h3>
    {assessment.actions.length ? <ol>{assessment.actions.map((item) => <li key={item.id}><strong>{item.title}:</strong> {item.recommendation}<p>{item.reason} {item.feasibility.text}</p></li>)}</ol> : <p>No outstanding recorded items. Review the completeness of the tender checklist and supporting records.</p>}
    <p>{ESTIMATE_NOTE}</p><p className="brief-disclaimer">{DISCLAIMER}</p>
  </section>;
}
