import { STATUS_COPY, STATUSES, requirementErrors } from "../lib/workspace.ts";
import type { BidRequirement, ReadinessStatus } from "../lib/workspace.ts";
import { feasibility } from "../lib/readiness.ts";

export function RequirementEditor({ item, remainingDays, onChange, onRemove }: {
  item: BidRequirement;
  remainingDays: number | null;
  onChange: (patch: Partial<BidRequirement>) => void;
  onRemove: () => void;
}) {
  const errors = requirementErrors(item);
  const errorId = item.id + "-errors";
  const timing = errors.length === 0 && remainingDays !== null ? feasibility(item, remainingDays) : null;
  return <article className="card requirement-editor" id={"requirement-" + item.id} aria-label={item.title || "Untitled requirement"}>
    <div className="card__header">
      <span className={"badge readiness-" + item.status}>{STATUS_COPY[item.status].label}</span>
      <button className="text-button danger" type="button" onClick={onRemove} aria-label={"Remove " + item.title}>Remove</button>
    </div>
    <label className="field"><span className="field__label">Requirement title</span>
      <input className="field__input" required maxLength={240} value={item.title} onChange={(event) => onChange({ title: event.target.value })} aria-invalid={!item.title.trim()} aria-describedby={errors.length ? errorId : undefined} />
    </label>
    <div className="requirement-controls">
      <label className="field"><span className="field__label">Preparation status</span>
        <select className="field__input" value={item.status} onChange={(event) => onChange({ status: event.target.value as ReadinessStatus })}>
          {STATUSES.map((status) => <option value={status} key={status}>{STATUS_COPY[status].label}</option>)}
        </select>
      </label>
      <label className="field"><span className="field__label">Estimated preparation days</span>
        <input className="field__input" type="number" min="0" step="any" placeholder="Unknown" value={item.estimatedDays === null || Number.isNaN(item.estimatedDays) ? "" : item.estimatedDays}
          onChange={(event) => onChange({ estimatedDays: event.target.validity.badInput ? Number.NaN : event.target.value === "" ? null : Number(event.target.value) })}
          aria-invalid={item.estimatedDays !== null && (!Number.isFinite(item.estimatedDays) || item.estimatedDays < 0)} aria-describedby={errors.length ? errorId : undefined} />
      </label>
      <label className="field"><span className="field__label">Reference page (optional)</span>
        <input className="field__input" type="number" min="1" step="1" placeholder="Not recorded" value={item.referencePage === null || Number.isNaN(item.referencePage) ? "" : item.referencePage}
          onChange={(event) => onChange({ referencePage: event.target.validity.badInput ? Number.NaN : event.target.value === "" ? null : Number(event.target.value) })}
          aria-invalid={item.referencePage !== null && (!Number.isSafeInteger(item.referencePage) || item.referencePage < 1)} aria-describedby={errors.length ? errorId : undefined} />
      </label>
    </div>
    <label className="check-field"><input type="checkbox" checked={item.mandatory} onChange={(event) => onChange({ mandatory: event.target.checked })} /> Mandatory requirement</label>
    <p className="hint">{STATUS_COPY[item.status].description}</p>
    {timing && <p className={"feasibility feasibility-" + timing.state}>{timing.text}</p>}
    <label className="field"><span className="field__label" id={item.id + "-notes-label"}>Notes / reference details (optional)</span>
      <textarea className="field__input" aria-labelledby={item.id + "-notes-label"} rows={2} maxLength={4000} value={item.notes} onChange={(event) => onChange({ notes: event.target.value })} />
    </label>
    <p className="hint">Reference pages and notes are entered by you; BidBridge has not inspected a document.</p>
    {errors.length > 0 && <ul className="error" role="alert" id={errorId}>{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
  </article>;
}
