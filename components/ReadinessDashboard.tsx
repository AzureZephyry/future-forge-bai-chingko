import { ADVISORY_LABELS, DISCLAIMER, ESTIMATE_NOTE } from "../lib/readiness.ts";
import type { ReadinessAssessment } from "../lib/readiness.ts";
import { STATUS_COPY, STATUSES } from "../lib/workspace.ts";
import { Link } from "react-router";

export function ReadinessDashboard({ assessment, actionPath = "" }: { assessment: ReadinessAssessment; actionPath?: string }) {
  const a = assessment;
  return <>
    <section className={"advisory advisory-" + a.outcome} aria-label="Preparation advisory" aria-live="polite">
      <p className="results__eyebrow">Current preparation advisory</p>
      <h2>{ADVISORY_LABELS[a.outcome]}</h2>
      <p>{a.explanation}</p>
      {a.remainingDays === 0 && <p><strong>Deadline is today.</strong> Calendar-date tracking does not establish the tender's exact closing time.</p>}
    </section>
    {a.errors.length > 0 && <ul className="error" role="alert">{a.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    {a.errors.length === 0 && <><section className="metrics" aria-label="Readiness summary">
      {[
        ["Unresolved mandatory", a.outstandingMandatory], ["Deadline risks", a.deadlineRisks],
        ["Calendar days remaining", a.remainingDays === null ? "—" : a.remainingDays],
        ["Ready items", a.counts.ready], ["Recorded requirements", a.total],
        ["Mandatory requirements", a.mandatory],
      ].map(([label, value], index) => <div className={"metric" + (index < 2 ? " metric--priority" : "")} key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>
    {a.actions[0] && actionPath && <section className="next-action" aria-label="Highest-priority next action"><p className="eyebrow">Highest-priority next action</p><h2>{a.actions[0].title}</h2><p>{a.actions[0].recommendation}</p><Link className="primary-button" to={actionPath + "#requirement-" + encodeURIComponent(a.actions[0].id)}>Review this requirement</Link></section>}
    <section className="progress-panel" aria-label="Recorded preparation progress">
      <div><strong>{a.readyPercentage === null ? "Not assessed" : a.readyPercentage + "% recorded ready"}</strong><span>Ready items ÷ all recorded items</span></div>
      {a.readyPercentage !== null && <progress value={a.readyPercentage} max={100} aria-label="Recorded ready percentage" />}
      <p className="hint">Claimed items do not count as ready. Completion never overrides mandatory blockers.</p>
      <div className="status-counts">{STATUSES.map((status) => <span className={"badge readiness-" + status} key={status}>{STATUS_COPY[status].label}: {a.counts[status]}</span>)}</div>
    </section>
    <section className="panel gap-panel" aria-label="Gap-to-Go actions">
      <p className="results__eyebrow">Turn a gap into a next step</p><h2>Gap-to-Go</h2>
      {a.blockers.length > 0 && <div className="blocker-panel"><h3>Critical blockers</h3><ul>{a.blockers.map((item) => <li key={item.id}><strong>{item.title}</strong><p>{item.reason}</p></li>)}</ul></div>}
      <p className="hint">{ESTIMATE_NOTE}</p>
      {a.actions.length === 0 ? <p>{a.outcome === "ready_for_review" ? "No unresolved recorded preparation items. Review supporting records and tender completeness." : "Add or correct requirements to produce preparation actions."}</p>
        : <ol className="action-list">{a.actions.map((item) => <li className="action-item" key={item.id}>
          <div className="action-heading"><Link to={actionPath + "#requirement-" + encodeURIComponent(item.id)}>{item.title}</Link><span className="hint">Priority group {item.priority} · {item.mandatory ? "Mandatory" : "Optional"} · {STATUS_COPY[item.status].label}</span></div>
          <p>{item.recommendation}</p><p className="hint">{item.reason}</p><p className={"feasibility feasibility-" + item.feasibility.state}>{item.feasibility.text}</p>
        </li>)}</ol>}
      <p className="advisory-disclaimer">{DISCLAIMER}</p>
    </section>
    </>}
  </>;
}
