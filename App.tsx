import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { analyze, DEMO_MODE } from "./api";
import { OverallBanner } from "./components/OverallBanner";
import { ProfileForm } from "./components/ProfileForm";
import { RequirementCard } from "./components/RequirementCard";
import { STATUS_LABELS } from "./components/StatusBadge";
import type { AnalysisResponse, RequirementStatus, SupplierProfile } from "./types";
import { isProfileReady, validateFile } from "./validation";

const DEFAULT_PROFILE: SupplierProfile = {
  business_name: "",
  industry: "",
  business_permit: "unknown",
  registration: "unknown",
  delivery_capacity: "",
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<SupplierProfile>(DEFAULT_PROFILE);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [previous, setPrevious] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ file: File; profile: SupplierProfile } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  const canSubmit = file !== null && isProfileReady(profile) && !loading;
  const stale = submitted !== null && (submitted.file !== file || JSON.stringify(submitted.profile) !== JSON.stringify(profile));

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const message = validateFile(selected);
    setError(message);
    setFile(message ? null : selected);
    if (message) event.target.value = "";
  }

  function removeFile() {
    setFile(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function formatFileSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canSubmit || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const next = await analyze(file, profile);
      setPrevious(submitted?.file === file ? result : null);
      setResult(next);
      setSubmitted({ file, profile: { ...profile } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  function hasChanged(requirement: string, status: string): boolean {
    // Generated ordinal IDs can refer to different requirements after reassessment.
    const before = previous?.requirements.find((r) => r.requirement === requirement);
    return before !== undefined && before.status !== status;
  }

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BidBridge home">
          <span className="brand__mark" aria-hidden="true">B</span>
          <span className="brand__name">BidBridge</span>
        </a>
        <span className="topbar__sub">Procurement readiness</span>
        {DEMO_MODE && <span className="mock-badge"><span /> Fixture demo · No live AI</span>}
      </header>

      <main className="layout" id="top">
        <section className="intro">
          <p className="intro__eyebrow">A clearer path to your next bid</p>
          <h1>Know where you stand<br className="intro__break" /> before you bid.</h1>
          <p className="intro__copy">Review tender requirements against your supplier profile, with the evidence and next steps in one place.</p>
        </section>

        <form className="panel" onSubmit={run} aria-label="Bid readiness inputs">
          <fieldset disabled={loading}>
          <legend className="visually-hidden">Tender and supplier information</legend>
          <div className="section-heading">
            <span className="section-heading__number">01</span>
            <h2 className="panel__title">Tender document</h2>
          </div>
          <label className="field">
            <span className="field__label">Procurement PDF (text-based)</span>
            <span className={`upload-control${file ? " upload-control--selected" : ""}`}>
              <span className="upload-control__icon" aria-hidden="true">
                {file ? "✓" : "↑"}
              </span>
              <span className="upload-control__copy">
                <strong>{file ? file.name : "Choose a tender PDF"}</strong>
                <small>{file ? `${formatFileSize(file.size)} · Ready to review` : "PDF format · Select a file from your device"}</small>
              </span>
              <span className="upload-control__action">{file ? "Change" : "Browse"}</span>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Choose procurement PDF"
                onChange={selectFile}
              />
            </span>
          </label>
          <p className="hint">Text-based PDF · Up to 15 MiB · Scanned images are not supported.</p>
          {file && <button type="button" className="text-button" onClick={removeFile}>Remove PDF</button>}

          <div className="section-heading section-heading--profile">
            <span className="section-heading__number">02</span>
            <h2 className="panel__title">Supplier profile</h2>
          </div>
          <p className="hint">Answers are self-reported and are not proof of compliance.</p>
          <ProfileForm profile={profile} onChange={setProfile} />
          </fieldset>

          <button className="btn" type="submit" disabled={!canSubmit}>
            {loading ? "Analyzing..." : result ? "Reassess Bid Readiness" : "Analyze Bid Readiness"}
          </button>
          {!file && <p className="hint upload-hint">Choose a PDF to enable analysis.</p>}
          {!isProfileReady(profile) && <p className="hint">Complete every supplier field. Choose or enter “unknown” if information is unavailable.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>

        <section className="results" aria-label="Gap-to-Go assessment" aria-busy={loading}>
          {!result && !loading && (
            <div className="empty empty--welcome">
              <div className="empty__illustration" aria-hidden="true">
                <span className="empty__paper"><i /><i /><i /></span>
                <span className="empty__spark">✦</span>
              </div>
              <p className="empty__eyebrow">Your review starts here</p>
              <h2>Make the tender easier to act on.</h2>
              <p>Upload a document and add your supplier details to see requirements, evidence, and suggested next steps together.</p>
              <div className="empty__steps" aria-label="Review steps">
                <span><b>1</b> Upload</span><span><b>2</b> Compare</span><span><b>3</b> Review evidence</span>
              </div>
            </div>
          )}
          {loading && (
            <div className="empty empty--loading" role="status" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <h2>{DEMO_MODE ? "Preparing fixture assessment" : "Reviewing your tender"}</h2>
              <p>{DEMO_MODE ? "Running the fictional demonstration through the backend. No live AI inference." : "Checking requirements and preparing the evidence for your review."}</p>
            </div>
          )}
          {result && !loading && (
            <>
              <div className="results__header">
                <p className="results__eyebrow">Gap-to-Go assessment</p>
                <span className="results__count">{result.requirements.length} {result.requirements.length === 1 ? "requirement" : "requirements"}</span>
              </div>
              <h2 className="results__title">{result.tender.title ?? "Your bid readiness review"}</h2>
              <p className="hint">
                Deadline: {result.tender.deadline ?? "Not established from supplied evidence"}
              </p>
              {stale && <p className="notice" role="status">Inputs changed. These findings reflect your previous submission. Reassess to review the updated information.</p>}
              {error && <p className="notice">The latest request failed. Showing the last successful assessment; no new result was produced.</p>}
              <OverallBanner overall={result.overall} />
              <aside className="uncertainty" aria-label="Assessment limitations">
                <h3>Evidence limits & uncertainty</h3>
                <p>{result.uncertainty || "Review the supplied evidence before making a bidding decision."}</p>
              </aside>
              <div className="status-summary" aria-label="Requirement status summary">
                {(Object.keys(STATUS_LABELS) as RequirementStatus[]).map((status) => (
                  <div key={status} className={`status-summary__item badge--${status}`}>
                    <strong>{result.requirements.filter((item) => item.status === status).length}</strong>
                    <span>{STATUS_LABELS[status]}</span>
                  </div>
                ))}
              </div>
              {result.requirements.length === 0 && <p className="notice">No requirements were established. Review the uncertainty above before taking action.</p>}
              {result.requirements.map((r) => (
                <RequirementCard key={r.id} item={r} changed={hasChanged(r.requirement, r.status)} />
              ))}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
