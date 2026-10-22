import type { SupplierProfile } from "./types";

export const PROFILE_LIMITS: Record<keyof SupplierProfile, number> = {
  business_name: 200,
  industry: 200,
  business_permit: 2000,
  registration: 2000,
  delivery_capacity: 4000,
};

export function isProfileReady(profile: SupplierProfile): boolean {
  return (Object.keys(PROFILE_LIMITS) as (keyof SupplierProfile)[]).every((key) => {
    const value = profile[key].trim();
    return value.length > 0 && value.length <= PROFILE_LIMITS[key];
  });
}

export function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Choose a PDF file (.pdf).";
  if (file.size === 0) return "The selected file is empty. Choose a text-based PDF.";
  if (file.size > 15 * 1024 * 1024) return "Choose a PDF no larger than 15 MiB.";
  return null;
}
