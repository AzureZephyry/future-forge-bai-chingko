import { useState } from "react";
import { analyze, USE_MOCK } from "./api";
import { OverallBanner } from "./components/OverallBanner";
import { ProfileForm } from "./components/ProfileForm";
import { RequirementCard } from "./components/RequirementCard";
import type { AnalysisResponse, SupplierProfile } from "./types";

const DEFAULT_PROFILE: SupplierProfile = {
  business_name: "Sample Cebu Supplier",
  industry: "Office supplies",
  business_permit: "available",
  registration: "unknown",
  delivery_capacity: "15 days",
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<SupplierProfile>(DEFAULT_PROFILE);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [previous, setPrevious] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = file !== null && !loading;

  function formatFileSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function run() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const next = await analyze(file, profile);
      setPrevious(result);
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function hasChanged(id: string, status: string): boolean {
    const before = previous?.requirements.find((r) => r.id === id);
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
        {USE_MOCK && <span className="mock-badge"><span /> Mock data</span>}
      </header>

      <main className="layout" id="top">
        <section className="intro">
          <p className="intro__eyebrow">A clearer path to your next bid</p>
          <h1>Know where you stand<br className="intro__break" /> before you bid.</h1>
          <p className="intro__copy">Review tender requirements against your supplier profile, with the evidence and next steps in one place.</p>
        </section>

        <section className="panel">
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
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Choose procurement PDF"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </span>
          </label>

          <div className="section-heading section-heading--profile">
            <span className="section-heading__number">02</span>
            <h2 className="panel__title">Supplier profile</h2>
          </div>
          <p className="hint">Answers are self-reported and are not proof of compliance.</p>
          <ProfileForm profile={profile} onChange={setProfile} />

          <button className="btn" disabled={!canSubmit} onClick={run}>
            {loading ? "Analyzing..." : result ? "Reassess" : "Analyze tender"}
          </button>
          {!file && <p className="hint upload-hint">Choose a PDF to enable analysis.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="results">
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
              <h2>Reviewing your tender</h2>
              <p>Checking requirements and preparing the evidence for your review.</p>
            </div>
          )}
          {result && !loading && (
            <>
              <div className="results__header">
                <p className="results__eyebrow">Tender assessment</p>
                <span className="results__count">{result.requirements.length} {result.requirements.length === 1 ? "requirement" : "requirements"}</span>
              </div>
              <h2 className="results__title">{result.tender.title}</h2>
              <p className="hint">
                Deadline: {result.tender.deadline ?? "Not found in the document"}
              </p>
              <OverallBanner overall={result.overall} />
              {result.requirements.map((r) => (
                <RequirementCard key={r.id} item={r} changed={hasChanged(r.id, r.status)} />
              ))}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
