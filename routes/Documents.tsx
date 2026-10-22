import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCommerce } from "../state/CommerceContext";
import { useWorkspace } from "../state/WorkspaceContext";
import { acceptDocuments, associateDocument, FILE_ACCEPT, getDocumentBlob, removeDocument } from "../lib/documents.ts";
import type { Acceptance, StoredDocument } from "../lib/documents.ts";
import { formatLocalTime, nextLocalMidnight } from "../lib/subscription.ts";
import { PlanIndicator } from "../components/PlanControls";
import { Icon } from "../components/Icon";

function FilePreview({ document: item, blob, onClose }: { document: StoredDocument; blob: Blob; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState(""), [text, setText] = useState("");
  useEffect(() => {
    const previous = document.activeElement, objectUrl = URL.createObjectURL(blob);
    let active = true;
    setUrl(objectUrl);
    if (item.mimeType === "text/plain") void blob.slice(0, 20_000).text().then((value) => { if (active) setText(value); });
    dialog.current?.showModal();
    return () => { active = false; URL.revokeObjectURL(objectUrl); dialog.current?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, [blob, item.mimeType]);
  return <dialog ref={dialog} className="file-preview" aria-label={"Preview " + item.name} onCancel={(event) => { event.preventDefault(); onClose(); }}><div className="card__header"><h2>{item.name}</h2><button className="secondary-button" type="button" onClick={onClose} autoFocus>Close preview</button></div><p className="hint">Local file preview. Content has not been verified against a requirement.</p>
    {item.mimeType === "application/pdf" ? (url ? <iframe title={item.name} src={url} sandbox="" /> : <p>Opening local preview…</p>) : item.mimeType.startsWith("image/") ? (url ? <img src={url} alt={"Uploaded supporting file: " + item.name} /> : <p>Opening local preview…</p>) : <><pre>{text}</pre>{blob.size > 20_000 && <p>Preview limited to the first 20 KB. Download for the full file.</p>}</>}
  </dialog>;
}
export function Documents() {
  const c = useCommerce(), w = useWorkspace();
  const [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<Acceptance[]>([]), [error, setError] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [preview, setPreview] = useState<{ document: StoredDocument; blob: Blob } | null>(null);
  const current = w.savedWorkspace;
  const disabled = busy || !c.snapshot || !!c.error || (c.plan === "free" && !!c.snapshot.quotaError);
  async function upload(files: File[]) {
    if (disabled || files.length === 0) return;
    setBusy(true); setError(""); setResults([]);
    const selected = current?.requirements.some((item) => item.id === requirementId) ? requirementId : null;
    try { setResults(await acceptDocuments(files, { workspaceId: selected ? current!.id : null, requirementId: selected })); await c.refresh(); }
    finally { setBusy(false); }
  }
  async function action(work: () => Promise<void>) { setError(""); try { await work(); await c.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "This local file operation could not be completed."); } }
  async function download(item: StoredDocument) {
    const blob = await getDocumentBlob(item.id), url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = item.name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="page-stack"><div className="page-heading"><p className="eyebrow">Keep the supporting details close</p><h1>Documents & evidence</h1><p>A local home for the files behind your preparation. Attachments never change readiness automatically.</p></div>
    <section className="panel upload-panel"><div className="section-heading"><Icon name="upload" /><h2>Add supporting files</h2></div><PlanIndicator />
      <p className="upload-allowance-note">Free includes three accepted uploads per local day; the allowance resets at {formatLocalTime(nextLocalMidnight(c.now))}. Pro Weekly removes the daily count cap during a simulated seven-day period, with no payment.</p>
      <div className={"document-dropzone " + (dragging ? "dragging" : "")} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
        <Icon name="documents" /><strong>Bring your evidence together.</strong><p>Drop files here, or choose them from your device.</p>
        <label className="primary-button file-picker">Choose supporting files<input type="file" multiple accept={FILE_ACCEPT} aria-label="Choose supporting files" disabled={disabled} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} /></label>
        <small>PDF, DOCX, TXT, PNG, JPG/JPEG · Up to 10 MB per file, on both plans</small>
      </div>
      <label className="field"><span className="field__label">Associate new files with a requirement (optional)</span><select className="field__input" value={requirementId} disabled={busy} onChange={(event) => setRequirementId(event.target.value)}><option value="">No association</option>{current?.requirements.map((item) => <option value={item.id} key={item.id}>{item.title || "Untitled requirement"}</option>)}</select></label>
      <p className="hint">Files are stored in this browser, without cloud backup or AI analysis. {w.scenario ? "Attachments and allowances are real local actions; associations use baseline requirements, not hypothetical changes." : "You choose the preparation status separately."} Duplicate filenames are allowed; each accepted file counts separately. Deletion does not refund Free allowance.</p>
      {busy && <p className="notice" role="status">Saving files to this browser…</p>}
      {results.length > 0 && <div className="upload-results" role="status"><strong>{results.filter((result) => result.accepted).length} accepted · {results.filter((result) => !result.accepted).length} not accepted</strong><ul>{results.map((result, index) => <li key={index} className={result.accepted ? "accepted" : "rejected"}>{result.accepted ? `${result.document.name} — stored locally` : `${result.name} — ${result.error}`}</li>)}</ul></div>}
    </section>
    {c.snapshot && c.plan === "free" && c.remaining === 0 && !c.snapshot.quotaError && <section className="panel upgrade-prompt" aria-label="Free allowance reached"><h2>Your three Free uploads are used for today.</h2><p>The next allowance starts at {formatLocalTime(nextLocalMidnight(c.now))}. Existing files and all preparation tools remain available.</p><p>Pro removes the daily upload-count limit. Activation here is a demonstration, with no payment.</p><div className="button-row"><Link className="primary-button" to="/pricing">View Pro Weekly</Link><Link className="secondary-button" to="/app">Return to workspace</Link></div></section>}
    {error && <p className="error" role="alert">{error}</p>}
    <section className="page-stack" aria-label="Saved documents"><div className="section-heading"><h2>Your evidence library</h2><span className="count-badge">{c.snapshot?.documents.length ?? 0} files</span></div>
      {c.snapshot?.documents.length === 0 && <div className="empty"><Icon name="documents" /><h3>No supporting files yet.</h3><p>Accepted files will appear here and remain available when your plan changes.</p></div>}
      {c.snapshot?.documents.map((item) => {
        const linked = item.workspaceId === current?.id && current.requirements.some((r) => r.id === item.requirementId);
        return <article className="panel document-card" key={item.id} aria-label={item.name}>
          <div className="document-heading"><span className="file-type">{item.name.split(".").pop()?.toUpperCase()}</span><div><h3>{item.name}</h3><p>{(item.sizeBytes / 1024).toFixed(1)} KB · Added {formatLocalTime(item.acceptedAt)}</p></div></div>
          {item.requirementId && !linked && <p className="hint">Previous opportunity or removed requirement. File retained; choose a new association if needed.</p>}
          <label className="field"><span className="field__label">Associated requirement for {item.name}</span><select className="field__input" value={linked ? item.requirementId! : ""} onChange={(event) => { const id = event.target.value; void action(() => associateDocument(item.id, { workspaceId: id ? current!.id : null, requirementId: id || null })); }}><option value="">No current association</option>{current?.requirements.map((r) => <option key={r.id} value={r.id}>{r.title || "Untitled requirement"}</option>)}</select></label>
          <div className="button-row">{!item.mimeType.includes("wordprocessingml") && <button className="secondary-button" type="button" onClick={() => { void action(async () => setPreview({ document: item, blob: await getDocumentBlob(item.id) })); }}>Open file</button>}<button className="secondary-button" type="button" onClick={() => { void action(() => download(item)); }}>Download</button><button className="text-button danger" type="button" onClick={() => { if (window.confirm("Remove " + item.name + " from local storage? Today's used allowance will not be refunded.")) void action(() => removeDocument(item.id)); }}>Remove file</button></div>
        </article>;
      })}
    </section>
    {preview && <FilePreview {...preview} onClose={() => setPreview(null)} />}
  </div>;
}
