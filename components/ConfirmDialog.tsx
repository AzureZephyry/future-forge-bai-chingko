import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export function ConfirmDialog({ title, confirmLabel, children, onConfirm, onClose }: {
  title: string; confirmLabel: string; children: ReactNode; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  async function confirm() { setBusy(true); setError(""); try { await onConfirm(); onClose(); } catch { setError("Could not save the change locally. Nothing was charged. Please try again."); setBusy(false); } }
  return <dialog className="confirm-dialog" ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <p className="eyebrow">A transparent product preview</p><h2 id={titleId}>{title}</h2>{children}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="button-row"><button className="secondary-button" type="button" disabled={busy} onClick={onClose} autoFocus>Cancel</button><button className="primary-button" type="button" disabled={busy} onClick={() => { void confirm(); }}>{busy ? "Saving locally…" : confirmLabel}</button></div>
  </dialog>;
}
