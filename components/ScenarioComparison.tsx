import { ADVISORY_LABELS } from "../lib/readiness.ts";
import type { ReadinessAssessment } from "../lib/readiness.ts";

function risks(assessment: ReadinessAssessment): Map<string, string> {
  const result = new Map(assessment.blockers.map((item) => [item.id, item.title + ": " + item.reason]));
  for (const item of assessment.actions) {
    if (item.feasibility.state === "overrun" || item.feasibility.state === "past_deadline") {
      result.set("estimate:" + item.id, item.title + ": " + item.feasibility.text);
    }
  }
  return result;
}

export function ScenarioComparison({ baseline, scenario, onDiscard, onApply }: {
  baseline: ReadinessAssessment;
  scenario: ReadinessAssessment;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const before = risks(baseline), after = risks(scenario);
  const removed = [...before].filter(([id]) => !after.has(id));
  const introduced = [...after].filter(([id]) => !before.has(id));
  return <section className="panel workspace-wide scenario-panel" aria-label="What-if comparison">
    <p className="fictional-label">HYPOTHETICAL SCENARIO — not saved</p>
    <h2>What would change?</h2>
    <p>All edits now affect this in-memory copy. Your baseline remains unchanged until you explicitly apply the scenario.</p>
    {scenario.errors.length > 0 ? <p className="error" role="alert">Correct invalid scenario fields before comparing or applying changes.</p> : <>
      <div className="comparison-grid">
        <div><h3>Baseline</h3><strong>{ADVISORY_LABELS[baseline.outcome]}</strong><p>{baseline.blockers.length} critical blockers · {baseline.unresolved} unresolved items · {baseline.deadlineRisks} deadline risks</p></div>
        <div><h3>Hypothetical scenario</h3><strong>{ADVISORY_LABELS[scenario.outcome]}</strong><p>{scenario.blockers.length} critical blockers · {scenario.unresolved} unresolved items · {scenario.deadlineRisks} deadline risks</p></div>
      </div>
      <p>Unresolved items: {baseline.unresolved} → {scenario.unresolved}. Deadline risks: {baseline.deadlineRisks} → {scenario.deadlineRisks}.</p>
      <div className="comparison-grid">
        <div><h3>Risks removed under these assumptions</h3>{removed.length ? <ul>{removed.map(([id, title]) => <li key={id}>{title}</li>)}</ul> : <p>None.</p>}</div>
        <div><h3>Risks introduced under these assumptions</h3>{introduced.length ? <ul>{introduced.map(([id, title]) => <li key={id}>{title}</li>)}</ul> : <p>None.</p>}</div>
      </div>
    </>}
    <p className="hint">A shorter estimate does not complete an item. A hypothetical Ready status does not prove supporting evidence exists or establish official compliance.</p>
    <div className="button-row"><button className="secondary-button" type="button" onClick={onDiscard}>Discard scenario</button><button className="primary-button" type="button" disabled={scenario.errors.length > 0} onClick={onApply}>Apply scenario to workspace</button></div>
  </section>;
}
