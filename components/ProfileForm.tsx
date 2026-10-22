import type { Availability, SupplierProfile } from "../types";

interface Props {
  profile: SupplierProfile;
  onChange: (next: SupplierProfile) => void;
}

const OPTIONS: { value: Availability; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "not_available", label: "Not available" },
  { value: "unknown", label: "Unknown" },
];

function AvailabilitySelect(props: {
  label: string;
  value: Availability;
  onChange: (v: Availability) => void;
}) {
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <select
        className="field__input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as Availability)}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProfileForm({ profile, onChange }: Props) {
  const set = <K extends keyof SupplierProfile>(key: K, value: SupplierProfile[K]) =>
    onChange({ ...profile, [key]: value });

  return (
    <div className="form-grid">
      <label className="field">
        <span className="field__label">Business name</span>
        <input
          className="field__input"
          value={profile.business_name}
          onChange={(e) => set("business_name", e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Industry</span>
        <input
          className="field__input"
          value={profile.industry}
          onChange={(e) => set("industry", e.target.value)}
        />
      </label>

      <AvailabilitySelect
        label="Business permit"
        value={profile.business_permit}
        onChange={(v) => set("business_permit", v)}
      />
      <AvailabilitySelect
        label="Business registration"
        value={profile.registration}
        onChange={(v) => set("registration", v)}
      />

      <label className="field">
        <span className="field__label">Delivery capacity</span>
        <input
          className="field__input"
          value={profile.delivery_capacity}
          onChange={(e) => set("delivery_capacity", e.target.value)}
        />
      </label>
    </div>
  );
}
