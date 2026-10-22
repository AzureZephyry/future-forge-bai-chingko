import { Link, useNavigate } from "react-router";
import { useWorkspace } from "../state/WorkspaceContext";
import { useCommerce } from "../state/CommerceContext";
import { OpportunityForm } from "../components/OpportunityForm";
import { RequirementEditor } from "../components/RequirementEditor";
import { ReadinessDashboard } from "../components/ReadinessDashboard";
import { ScenarioComparison } from "../components/ScenarioComparison";
import { DecisionBrief } from "../components/DecisionBrief";
import { PlanIndicator } from "../components/PlanControls";
import { Icon } from "../components/Icon";

export function WorkspaceEmpty() {
  return <section className="empty"><Icon name="opportunity" /><h2>A clearer bid starts here.</h2><p>Create an opportunity and record its requirements, or explore the fictional example.</p><Link className="primary-button" to="/app/opportunity">Create opportunity</Link></section>;
}
function OpportunityOverview({ editable = false }: { editable?: boolean }) {
  const w = useWorkspace();
  if (!w.workspace) return null;
  return <section className="panel opportunity-overview" aria-label="Current opportunity">
    <p className="eyebrow">Your opportunity</p><h2>{w.workspace.title || "Untitled opportunity"}</h2>
    {w.workspace.fictional && <p className="fictional-label">FICTIONAL DEMONSTRATION — editable planning example</p>}
    <p><strong>{w.workspace.organization || "Organization not entered"}</strong> · Deadline: <time dateTime={w.workspace.deadline}>{w.workspace.deadline || "Not entered"}</time></p>
    {w.workspace.description && <p className="hint">{w.workspace.description}</p>}
    {editable && <details className="opportunity-edit"><summary>Edit opportunity details</summary><OpportunityForm value={w.workspace} onChange={(patch) => w.edit((current) => ({ ...current, ...patch }))} /></details>}
  </section>;
}
export function RequirementWorkspace() {
  const w = useWorkspace(), { snapshot } = useCommerce();
  if (!w.workspace || !w.assessment) return null;
  return <section className="requirements-column" aria-label="Requirement workspace">
    <div className="section-heading"><h2>Requirement workspace</h2></div>
    <p className="hint">Record the tender's requirements and your preparation status. Ready is your statement, not independent verification.</p>
    <form className="panel add-requirement" onSubmit={w.addRequirement} aria-label="Add requirement">
      <label className="field"><span className="field__label">New requirement title</span><input className="field__input" required maxLength={240} value={w.requirementTitle} onChange={(event) => w.setRequirementTitle(event.target.value)} /></label>
      <label className="check-field"><input type="checkbox" checked={w.newMandatory} onChange={(event) => w.setNewMandatory(event.target.checked)} /> New item is mandatory</label>
      <button className="primary-button" disabled={w.workspace.requirements.length >= 100} type="submit">Add requirement</button>
    </form>
    {w.workspace.requirements.length === 0 && <p className="notice">No requirements recorded. An empty checklist is not ready for review.</p>}
    {w.workspace.requirements.map((item) => <div className="requirement-wrap" key={item.id}>
      <RequirementEditor item={item} remainingDays={w.assessment!.remainingDays}
        onChange={(patch) => w.edit((current) => ({ ...current, requirements: current.requirements.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry) }))}
        onRemove={() => { if (window.confirm("Remove " + item.title + " from this checklist? Attached files will be kept in Documents.")) w.edit((current) => ({ ...current, requirements: current.requirements.filter((entry) => entry.id !== item.id) })); }} />
      <Link className="attachment-link" to="/app/documents">{snapshot?.documents.filter((doc) => doc.workspaceId === w.workspace!.id && doc.requirementId === item.id).length ?? 0} supporting document(s) attached · Manage evidence →</Link>
    </div>)}
  </section>;
}
export function Dashboard() {
  const w = useWorkspace(), c = useCommerce();
  return <div className="page-stack">
    <div className="page-heading"><p className="eyebrow">Your preparation, at a glance</p><h1>Know your gaps.<br />Find your next move.</h1><p>One clear view of what is ready, what needs attention, and where to go next.</p></div>
    <div className="quick-actions"><Link to="/app/opportunity"><Icon name="opportunity" /> Open opportunity</Link><Link to="/app/documents"><Icon name="upload" /> Upload documents</Link><Link to="/app/simulator"><Icon name="simulator" /> Open Gap-to-Go</Link><Link to="/app/report"><Icon name="report" /> View decision brief</Link></div>
    {w.workspace && w.assessment ? <><OpportunityOverview /><div className="dashboard-grid"><div className="assessment-column"><ReadinessDashboard assessment={w.assessment} actionPath="/app/opportunity" /></div><aside className="page-stack"><section className="panel"><p className="eyebrow">Evidence library</p><strong className="big-number">{c.snapshot?.documents.length ?? "—"}</strong><h2>Documents on this browser</h2><p>Organize supporting files without changing your recorded readiness.</p><Link to="/app/documents" className="text-link">Open evidence library →</Link></section><section className="panel"><h2>Your plan</h2><PlanIndicator /><Link to="/app/plan" className="text-link">Manage demo access →</Link></section><section className="panel sage-panel"><Icon name="simulator" /><h2>What could change?</h2><p>Test an estimate or status in an independent copy. See which risks would clear before changing your workspace.</p><Link to="/app/simulator" className="secondary-button">Explore a scenario</Link></section></aside></div></> : <WorkspaceEmpty />}
  </div>;
}
export function Opportunity() {
  const w = useWorkspace(), navigate = useNavigate();
  return <div className="page-stack">
    <div className="page-heading"><p className="eyebrow">A place for every requirement</p><h1>Opportunity & requirements</h1><p>Enter the tender's details. Build a checklist that reflects the actual opportunity.</p></div>
    {w.creating && <section className="panel" aria-label="Create opportunity"><h2>Create an opportunity</h2><p className="hint">No account or AI service required. Unsubmitted details stay in this tab until you create the workspace.</p><form onSubmit={w.createOpportunity}><OpportunityForm value={w.draft} onChange={(patch) => w.setDraft((current) => ({ ...current, ...patch }))} /><div className="button-row"><button className="primary-button" type="submit">Create workspace</button>{w.workspace && <button className="secondary-button" type="button" onClick={() => { w.setCreating(false); w.setError(""); }}>Cancel creation</button>}</div></form></section>}
    {w.workspace && w.assessment && <><OpportunityOverview editable /><div className="button-row"><button className="primary-button" type="button" disabled={w.creating || !!w.scenario || w.assessment.errors.length > 0} onClick={() => { w.startScenario(); navigate("/app/simulator"); }}>Start what-if scenario</button><Link className="secondary-button" to="/app/report">View decision brief</Link></div><div className="editor-grid"><div className="assessment-column"><ReadinessDashboard assessment={w.assessment} /></div><RequirementWorkspace /></div></>}
  </div>;
}
export function Simulator() {
  const w = useWorkspace();
  return <div className="page-stack"><div className="page-heading"><p className="eyebrow">The Gap-to-Go simulator</p><h1>A different assumption.<br />A clearer next step.</h1><p>Explore what would improve or worsen preparation. Your saved baseline stays intact.</p></div>
    {!w.workspace || !w.assessment ? <WorkspaceEmpty /> : <>
      <OpportunityOverview />
      {w.scenario && w.baselineAssessment ? <ScenarioComparison baseline={w.baselineAssessment} scenario={w.assessment} onDiscard={w.discardScenario} onApply={w.applyScenario} /> : <section className="panel sage-panel"><h2>Try a change before recording it.</h2><p>Start an independent copy, then adjust status, estimates, mandatory items or the deadline. Scenarios stay available as you navigate; refreshing restores the saved baseline.</p><button className="primary-button" type="button" disabled={w.creating || w.assessment.errors.length > 0} onClick={w.startScenario}>Start what-if scenario</button></section>}
      {w.scenario && <><details className="panel opportunity-edit"><summary>Edit opportunity details</summary><OpportunityForm value={w.workspace} onChange={(patch) => w.edit((current) => ({ ...current, ...patch }))} /></details><Link className="secondary-button fit-content" to="/app/report">View decision brief</Link></>}
      <div className={w.scenario ? "editor-grid" : ""}><div className="assessment-column"><ReadinessDashboard assessment={w.assessment} actionPath={w.scenario ? undefined : "/app/opportunity"} /></div>{w.scenario && <RequirementWorkspace />}</div>
    </>}
  </div>;
}
export function Report() {
  const w = useWorkspace(), navigate = useNavigate();
  return <div className="page-stack report-page"><div className="page-heading"><p className="eyebrow">Prepared for a conversation</p><h1>Your bid decision brief</h1><p>A clear record of preparation, blockers and next actions.</p></div>
    {!w.workspace || !w.assessment ? <WorkspaceEmpty /> : w.assessment.errors.length ? <p className="error" role="alert">Correct invalid workspace fields before producing a brief. <Link to={w.scenario ? "/app/simulator" : "/app/opportunity"}>Return to editing</Link></p> : <DecisionBrief workspace={w.workspace} assessment={w.assessment} today={w.today} hypothetical={!!w.scenario} onClose={() => navigate(w.scenario ? "/app/simulator" : "/app")} />}
  </div>;
}
