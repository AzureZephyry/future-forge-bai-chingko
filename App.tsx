import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { OpportunityForm } from "./components/OpportunityForm";
import type { OpportunityFields } from "./components/OpportunityForm";
import { RequirementEditor } from "./components/RequirementEditor";
import { ReadinessDashboard } from "./components/ReadinessDashboard";
import { assessWorkspace, DISCLAIMER } from "./lib/readiness.ts";
import { createDemo } from "./lib/demo.ts";
import { loadWorkspace, saveWorkspace } from "./lib/storage.ts";
import type { LoadResult } from "./lib/storage.ts";
import { localDate, workspaceErrors } from "./lib/workspace.ts";
import type { BidRequirement, TenderWorkspace } from "./lib/workspace.ts";

const EMPTY_OPPORTUNITY: OpportunityFields = { title: "", organization: "", deadline: "", description: "" };

function restore(): LoadResult {
  try { return loadWorkspace(window.localStorage); }
  catch { return { state: "unavailable", workspace: null, message: "Browser storage is unavailable. Work remains in this tab only." }; }
}

export default function App() {
  const [initial] = useState(restore);
  const [workspace, setWorkspace] = useState<TenderWorkspace | null>(initial.workspace);
  const [saveState, setSaveState] = useState(initial.message);
  const [creating, setCreating] = useState(initial.workspace === null);
  const [draft, setDraft] = useState<OpportunityFields>(EMPTY_OPPORTUNITY);
  const [error, setError] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [newMandatory, setNewMandatory] = useState(true);
  const [today, setToday] = useState(() => localDate(new Date()));

  useEffect(() => {
    const update = () => setToday(localDate(new Date()));
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  useEffect(() => {
    if (!workspace) return;
    if (workspaceErrors(workspace).length) {
      setSaveState("Invalid draft — not saved. The last valid saved workspace is retained.");
      return;
    }
    try { setSaveState(saveWorkspace(window.localStorage, workspace).message); }
    catch { setSaveState("Unable to save locally. Keep this tab open; changes may be lost on refresh."); }
  }, [workspace]);

  const unsaved = (workspace !== null && (workspaceErrors(workspace).length > 0 || saveState.startsWith("Unable")))
    || (creating && Object.values(draft).some((value) => value.trim().length > 0));
  useEffect(() => {
    if (!unsaved) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [unsaved]);

  function edit(change: (current: TenderWorkspace) => TenderWorkspace) {
    setWorkspace((current) => current ? { ...change(current), updatedAt: new Date().toISOString() } : current);
    setError("");
  }

  function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: TenderWorkspace = {
      ...draft, title: draft.title.trim(), organization: draft.organization.trim(),
      id: crypto.randomUUID(), fictional: false, requirements: [], updatedAt: new Date().toISOString(),
    };
    const errors = workspaceErrors(next);
    if (errors.length) { setError(errors.join(" ")); return; }
    if (workspace && !window.confirm("Replace the current saved workspace with this new opportunity?")) return;
    setWorkspace(next); setCreating(false); setDraft(EMPTY_OPPORTUNITY); setError(""); setRequirementTitle("");
  }

  function loadDemo() {
    if (workspace && !window.confirm("Replace this workspace with a fresh fictional demo? The current local workspace will be replaced.")) return;
    setWorkspace(createDemo(today, crypto.randomUUID(), new Date().toISOString()));
    setCreating(false); setError(""); setRequirementTitle("");
  }

  function addRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || workspace.requirements.length >= 100) { setError("A workspace supports up to 100 requirements."); return; }
    if (!requirementTitle.trim()) { setError("Enter a nonblank requirement title."); return; }
    const item: BidRequirement = {
      id: crypto.randomUUID(), title: requirementTitle.trim(), mandatory: newMandatory,
      status: "unknown", estimatedDays: null, referencePage: null, notes: "",
    };
    edit((current) => ({ ...current, requirements: [...current.requirements, item] }));
    setRequirementTitle("");
  }

  const assessment = workspace ? assessWorkspace(workspace, today) : null;

  return <div className="workspace-app">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand__mark" aria-hidden="true">B</span><span className="brand__name">BidBridge</span></a>
      <span className="topbar__sub">Know Before You Bid.</span>
      <span className="save-state" role="status">{saveState}</span>
      <div className="header-actions">
        <button className="secondary-button" type="button" onClick={() => { setCreating(true); setError(""); }}>New opportunity</button>
        <button className="primary-button" type="button" onClick={loadDemo}>Load fictional demo</button>
      </div>
    </header>
    <main className="workspace-layout" id="top">
      <section className="intro workspace-intro">
        <p className="intro__eyebrow">Procurement preparation, made clearer</p>
        <h1>Know your gaps.<br />Find your next move.</h1>
        <p className="intro__copy">Track requirements, spot deadline risks, and turn preparation gaps into a practical plan. Decisions update as your information changes.</p>
        <p className="local-note">Local workspace · No account or AI service required</p>
      </section>
      {error && <p className="error workspace-wide" role="alert">{error}</p>}
      {!workspace && initial.state !== "loaded" && initial.state !== "empty" && <p className="notice workspace-wide">{initial.message}</p>}
      {creating && <section className="panel workspace-wide" aria-label="Create opportunity">
        <div className="section-heading"><span className="section-heading__number">01</span><h2>Create an opportunity</h2></div>
        <p className="hint">Copy details from your tender. BidBridge does not invent requirements or legal rules.</p>
        <form onSubmit={createOpportunity}>
          <OpportunityForm value={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
          <div className="button-row"><button className="primary-button" type="submit">Create workspace</button>
            {workspace && <button className="secondary-button" type="button" onClick={() => { setCreating(false); setError(""); }}>Cancel creation</button>}
          </div>
        </form>
      </section>}
      {!workspace && <section className="empty workspace-wide">
        <h2>Your next bid starts with a clear checklist.</h2>
        <p>Create an opportunity or load the fictional six-requirement example. Your work is saved only in this browser; avoid entering sensitive personal information.</p>
      </section>}
      {workspace && assessment && <>
        <section className="panel workspace-wide opportunity-overview" aria-label="Current opportunity">
          <div className="section-heading"><span className="section-heading__number">01</span><h2>{workspace.title || "Untitled opportunity"}</h2></div>
          {workspace.fictional && <p className="fictional-label">FICTIONAL DEMONSTRATION — editable planning example</p>}
          <p><strong>{workspace.organization || "Organization not entered"}</strong> · Deadline: <time dateTime={workspace.deadline}>{workspace.deadline || "Not entered"}</time></p>
          {workspace.description && <p className="hint">{workspace.description}</p>}
          <details className="opportunity-edit"><summary>Edit opportunity details</summary>
            <OpportunityForm value={workspace} onChange={(patch) => edit((current) => ({ ...current, ...patch }))} />
          </details>
        </section>
        <div className="assessment-column" aria-label="Live preparation assessment">
          <ReadinessDashboard assessment={assessment} />
        </div>
        <section className="requirements-column" aria-label="Requirement workspace">
          <div className="section-heading"><span className="section-heading__number">02</span><h2>Requirement workspace</h2></div>
          <p className="hint">Copy the tender's requirements, then record what is prepared. All edits recalculate instantly. Ready is your statement, not independent verification.</p>
          <form className="panel add-requirement" onSubmit={addRequirement} aria-label="Add requirement">
            <label className="field"><span className="field__label">New requirement title</span>
              <input className="field__input" required maxLength={240} value={requirementTitle} onChange={(event) => setRequirementTitle(event.target.value)} />
            </label>
            <label className="check-field"><input type="checkbox" checked={newMandatory} onChange={(event) => setNewMandatory(event.target.checked)} /> New item is mandatory</label>
            <button className="primary-button" disabled={workspace.requirements.length >= 100} type="submit">Add requirement</button>
          </form>
          {workspace.requirements.length === 0 && <p className="notice">No requirements recorded. An empty checklist is not ready for review.</p>}
          {workspace.requirements.map((item) => <RequirementEditor key={item.id} item={item} remainingDays={assessment.remainingDays}
            onChange={(patch) => edit((current) => ({ ...current, requirements: current.requirements.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry) }))}
            onRemove={() => { if (window.confirm("Remove " + item.title + " from this checklist?")) edit((current) => ({ ...current, requirements: current.requirements.filter((entry) => entry.id !== item.id) })); }} />)}
        </section>
      </>}
      <footer className="workspace-wide workspace-footer"><p>{DISCLAIMER}</p><p>One workspace, stored on this device. No government-portal connection or automated bid submission.</p></footer>
    </main>
  </div>;
}
