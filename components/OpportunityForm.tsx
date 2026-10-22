export interface OpportunityFields {
  title: string;
  organization: string;
  deadline: string;
  description: string;
}
export function OpportunityForm({ value, onChange }: {
  value: OpportunityFields;
  onChange: (patch: Partial<OpportunityFields>) => void;
}) {
  const descriptionLabel = useId();
  return <div className="opportunity-fields">
    <label className="field"><span className="field__label">Opportunity title</span>
      <input className="field__input" required maxLength={240} value={value.title} onChange={(event) => onChange({ title: event.target.value })} />
    </label>
    <label className="field"><span className="field__label">Organization</span>
      <input className="field__input" required maxLength={240} value={value.organization} onChange={(event) => onChange({ organization: event.target.value })} />
    </label>
    <label className="field"><span className="field__label">Submission deadline</span>
      <input className="field__input" type="date" required min="0001-01-01" max="9999-12-31" value={value.deadline} onChange={(event) => onChange({ deadline: event.target.value })} />
    </label>
    <label className="field opportunity-description"><span className="field__label" id={descriptionLabel}>Description (optional)</span>
      <textarea className="field__input" aria-labelledby={descriptionLabel} rows={2} maxLength={4000} value={value.description} onChange={(event) => onChange({ description: event.target.value })} />
    </label>
  </div>;
}
import { useId } from "react";

