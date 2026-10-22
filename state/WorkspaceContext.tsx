import { createContext, useContext, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { OpportunityFields } from "../components/OpportunityForm";
import { assessWorkspace } from "../lib/readiness.ts";
import { createDemo } from "../lib/demo.ts";
import { loadWorkspace, saveWorkspace } from "../lib/storage.ts";
import type { LoadResult } from "../lib/storage.ts";
import { localDate, workspaceErrors } from "../lib/workspace.ts";
import type { BidRequirement, TenderWorkspace } from "../lib/workspace.ts";

const EMPTY_OPPORTUNITY: OpportunityFields = { title: "", organization: "", deadline: "", description: "" };

function restore(): LoadResult {
  try { return loadWorkspace(window.localStorage); }
  catch { return { state: "unavailable", workspace: null, message: "Browser storage is unavailable. Work remains in this tab only." }; }
}

function useWorkspaceState() {
  const [initial] = useState(restore);
  const [savedWorkspace, setWorkspace] = useState<TenderWorkspace | null>(initial.workspace);
  const [scenario, setScenario] = useState<TenderWorkspace | null>(null);
  const workspace = scenario ?? savedWorkspace;
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
    if (!savedWorkspace) return;
    if (workspaceErrors(savedWorkspace).length) {
      setSaveState("Invalid draft — not saved. The last valid saved workspace is retained.");
      return;
    }
    try { setSaveState(saveWorkspace(window.localStorage, savedWorkspace).message); }
    catch { setSaveState("Unable to save locally. Keep this tab open; changes may be lost on refresh."); }
  }, [savedWorkspace]);

  const unsaved = (workspace !== null && (workspaceErrors(workspace).length > 0 || saveState.startsWith("Unable")))
    || scenario !== null || (creating && Object.values(draft).some((value) => value.trim().length > 0));
  useEffect(() => {
    if (!unsaved) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [unsaved]);

  function edit(change: (current: TenderWorkspace) => TenderWorkspace) {
    const update = scenario ? setScenario : setWorkspace;
    update((current) => current ? { ...change(current), updatedAt: new Date().toISOString() } : current);
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
    const unsavedOpportunity = creating && Object.values(draft).some((value) => value.trim().length > 0);
    if ((workspace || unsavedOpportunity) && !window.confirm(workspace
      ? "Replace this workspace with a fresh fictional demo? The current local workspace will be replaced."
      : "Discard the unsubmitted opportunity details and load the fictional demo?")) return;
    setWorkspace(createDemo(today, crypto.randomUUID(), new Date().toISOString()));
    setCreating(false); setDraft(EMPTY_OPPORTUNITY); setError(""); setRequirementTitle("");
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
  const baselineAssessment = savedWorkspace ? assessWorkspace(savedWorkspace, today) : null;

  function startScenario() {
    if (!savedWorkspace || workspaceErrors(savedWorkspace).length) return;
    setScenario(structuredClone(savedWorkspace)); setError(""); setRequirementTitle("");
  }

  function discardScenario() {
    if (!window.confirm("Discard all hypothetical changes and return to the unchanged baseline?")) return;
    setScenario(null); setError(""); setRequirementTitle("");
  }

  function applyScenario() {
    if (!scenario || workspaceErrors(scenario).length) return;
    if (!window.confirm("Apply these hypothetical assumptions to your real workspace and save locally? Confirm statuses reflect what you intend to record; this does not verify supporting evidence.")) return;
    setWorkspace({ ...structuredClone(scenario), updatedAt: new Date().toISOString() });
    setScenario(null); setError(""); setRequirementTitle("");
  }

  return { initial, savedWorkspace, workspace, scenario, saveState, creating, setCreating, draft, setDraft,
    error, setError, requirementTitle, setRequirementTitle, newMandatory, setNewMandatory,
    today, assessment, baselineAssessment, edit, createOpportunity, loadDemo, addRequirement,
    startScenario, discardScenario, applyScenario };
}
const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return <WorkspaceContext.Provider value={state}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const state = useContext(WorkspaceContext);
  if (!state) throw new Error("Workspace provider missing");
  return state;
}
