import { useState } from "react";
import { Link } from "react-router";
import { useCommerce } from "../state/CommerceContext";
import { accessRemaining, DEMO_NOTICE, formatLocalTime, nextLocalMidnight, PLAN_CONFIG, PRICE_NOTICE } from "../lib/subscription.ts";
import { setDemoPlan } from "../lib/documents.ts";
import { ConfirmDialog } from "./ConfirmDialog";

export function PlanIndicator() {
  const { snapshot, plan, subscription, remaining, error } = useCommerce();
  return <div className="plan-indicator" aria-label="Plan and upload allowance" aria-live="polite">
    <span className={"plan-badge " + (plan === "pro_weekly" ? "pro" : "")}>{plan === "pro_weekly" ? "Pro Weekly · demo" : "Free"}</span>
    <span>{error ? "Storage unavailable" : !snapshot ? "Loading local allowance…" : plan === "pro_weekly" ? "Expires " + formatLocalTime(subscription.expiresAt!) : `${remaining} of ${PLAN_CONFIG.freeUploads} uploads remaining`}</span>
  </div>;
}
export function ActivateProButton({ renewal = false }: { renewal?: boolean }) {
  const [open, setOpen] = useState(false);
  const { refresh, error, snapshot } = useCommerce();
  return <>
    <button className="primary-button" type="button" disabled={!!error || !snapshot} onClick={() => setOpen(true)}>{renewal ? "Restart 7-day demo period" : "Preview Pro Weekly"}</button>
    {open && <ConfirmDialog title={renewal ? "Restart simulated Pro access?" : "Preview seven days of Pro"} confirmLabel="Activate Demo Pro" onClose={() => setOpen(false)} onConfirm={async () => { await setDemoPlan(true); await refresh(); }}>
      <p>Activate 7 days of simulated Pro access on this browser? This is a product demonstration. No payment, account creation, or automatic renewal will occur.</p>
      {renewal && <p>This explicitly restarts a new 168-hour period from now; unused time is not added.</p>}
      <p className="notice">No daily upload-count limit during active access. The 10 MB per-file limit and available browser storage still apply.</p>
    </ConfirmDialog>}
  </>;
}
export function PlanManagement() {
  const c = useCommerce();
  const [ending, setEnding] = useState(false);
  const expired = c.subscription.plan === "pro_weekly" && c.plan === "free";
  return <div className="page-stack">
    <div className="page-heading"><p className="eyebrow">Your local access</p><h1>Plan & usage</h1><p>Choose the upload capacity that fits your preparation week.</p></div>
    <section className="panel plan-detail"><PlanIndicator /><h2>{c.plan === "pro_weekly" ? "Your Pro preview is active." : "Keep preparing with Free."}</h2>
      {expired && <p className="notice">Your demo Pro period expired. Free limits now apply; your documents remain available. There was no charge or automatic renewal.</p>}
      {c.subscription.activatedAt && <dl className="detail-list"><div><dt>Demo activated</dt><dd>{formatLocalTime(c.subscription.activatedAt)}</dd></div><div><dt>Expires</dt><dd>{formatLocalTime(c.subscription.expiresAt!)}</dd></div><div><dt>Time remaining</dt><dd>{accessRemaining(c.subscription, c.now)}</dd></div></dl>}
      <p>{c.plan === "pro_weekly" ? "No daily numerical upload cap during this period. Pro uploads do not consume Free slots." : "Three successfully stored files per local calendar day. Deleting files does not restore allowance."}</p>
      <p>Free allowance resets at {formatLocalTime(nextLocalMidnight(c.now))}.</p>
      <p>All preparation tools, Gap-to-Go scenarios and decision briefs are available on both plans.</p>
      <div className="button-row"><ActivateProButton renewal={c.plan === "pro_weekly"} />{c.plan === "pro_weekly" && <button className="secondary-button" type="button" onClick={() => setEnding(true)}>End demo Pro</button>}<Link to="/pricing" className="text-link">Compare plans →</Link></div>
    </section>
    <section className="panel"><h2>A business model in preview</h2><p>Pro Weekly is an illustrative ₱{PLAN_CONFIG.weeklyPricePHP} per 7-day period. {PRICE_NOTICE}</p><p>{DEMO_NOTICE}</p><p className="hint">Entitlements and files belong to this browser, without an account or cloud backup. Device time and local data can be changed; this is not production billing enforcement.</p></section>
    {ending && <ConfirmDialog title="End demo Pro?" confirmLabel="Return to Free" onClose={() => setEnding(false)} onConfirm={async () => { await setDemoPlan(false); await c.refresh(); }}><p>Free limits will apply immediately, using any Free uploads already consumed today. Existing files and preparation tools remain available.</p></ConfirmDialog>}
  </div>;
}
