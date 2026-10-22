/** User-entered preparation records. No legal rules or inferred qualifications. */
export const STATUSES = ["ready", "claimed", "missing", "unknown", "conflict"] as const;
export type ReadinessStatus = typeof STATUSES[number];
export const STATUS_COPY: Record<ReadinessStatus, { label: string; description: string }> = {
  ready: { label: "Ready", description: "You report the item is prepared and supporting evidence is available. Not official verification." },
  claimed: { label: "Claimed", description: "Reported satisfied; supporting documentation has not been confirmed." },
  missing: { label: "Missing", description: "Explicitly unavailable or incomplete." },
  unknown: { label: "Unknown", description: "Insufficient information; verify the requirement's state." },
  conflict: { label: "Conflict", description: "You identified information incompatible with this requirement." },
};

export interface BidRequirement {
  id: string;
  title: string;
  mandatory: boolean;
  status: ReadinessStatus;
  estimatedDays: number | null;
  referencePage: number | null;
  notes: string;
}

export interface TenderWorkspace {
  id: string;
  title: string;
  organization: string;
  deadline: string;
  description: string;
  fictional: boolean;
  requirements: BidRequirement[];
  updatedAt: string;
}

const DAY = 86_400_000;

/** Gregorian calendar ordinal, independent of timestamp offset and DST. */
export function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime() / DAY;
}

export function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarDays(value: string, days: number): string {
  const ordinal = calendarDay(value);
  if (ordinal === null || !Number.isInteger(days)) throw new Error("Invalid calendar date or day count");
  const result = new Date((ordinal + days) * DAY).toISOString().slice(0, 10);
  if (calendarDay(result) === null) throw new Error("Calendar result is outside supported years 0001–9999");
  return result;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maximum: number, required = true): boolean {
  return typeof value === "string" && value.length <= maximum && (!required || value.trim().length > 0);
}

export function requirementErrors(value: unknown): string[] {
  if (!record(value)) return ["Requirement must be an object."];
  const errors: string[] = [];
  const keys = ["id", "title", "mandatory", "status", "estimatedDays", "referencePage", "notes"];
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) errors.push("Requirement fields are incomplete or unsupported.");
  if (!text(value.id, 100)) errors.push("Requirement ID is invalid.");
  if (!text(value.title, 240)) errors.push("Requirement title is required (up to 240 characters).");
  if (typeof value.mandatory !== "boolean") errors.push("Mandatory designation must be boolean.");
  if (!STATUSES.includes(value.status as ReadinessStatus)) errors.push("Choose a valid preparation status.");
  if (value.estimatedDays !== null && (typeof value.estimatedDays !== "number" || !Number.isFinite(value.estimatedDays) || value.estimatedDays < 0)) errors.push("Preparation days must be blank or a finite number of zero or more.");
  if (value.referencePage !== null && (typeof value.referencePage !== "number" || !Number.isSafeInteger(value.referencePage) || value.referencePage < 1)) errors.push("Reference page must be blank or a positive whole number.");
  if (!text(value.notes, 4000, false)) errors.push("Notes must be text of up to 4000 characters.");
  return errors;
}

export function workspaceErrors(value: unknown): string[] {
  if (!record(value)) return ["Workspace must be an object."];
  const errors: string[] = [];
  const keys = ["id", "title", "organization", "deadline", "description", "fictional", "requirements", "updatedAt"];
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) errors.push("Workspace fields are incomplete or unsupported.");
  if (!text(value.id, 100)) errors.push("Workspace ID is invalid.");
  if (!text(value.title, 240)) errors.push("Opportunity title is required (up to 240 characters).");
  if (!text(value.organization, 240)) errors.push("Organization is required (up to 240 characters).");
  if (typeof value.deadline !== "string" || calendarDay(value.deadline) === null) errors.push("Enter a valid deadline as YYYY-MM-DD.");
  if (!text(value.description, 4000, false)) errors.push("Description must be text of up to 4000 characters.");
  if (typeof value.fictional !== "boolean") errors.push("Workspace origin is invalid.");
  if (typeof value.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt)) || new Date(value.updatedAt).toISOString() !== value.updatedAt) errors.push("Saved modification timestamp is invalid.");
  if (!Array.isArray(value.requirements) || value.requirements.length > 100) {
    errors.push("Record up to 100 requirements in one workspace.");
  } else {
    const ids = new Set<string>();
    value.requirements.forEach((item: unknown, index: number) => {
      for (const error of requirementErrors(item)) errors.push(`Requirement ${index + 1}: ${error}`);
      if (record(item) && typeof item.id === "string") {
        if (ids.has(item.id)) errors.push("Requirement IDs must be unique.");
        ids.add(item.id);
      }
    });
  }
  return errors;
}

export function isWorkspace(value: unknown): value is TenderWorkspace {
  return workspaceErrors(value).length === 0;
}
