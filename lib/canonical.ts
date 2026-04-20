// Canonical schema and related constants. Single source of truth consumed by
// the API route (for the tool enum), the PII scrubber (for known-good tokens),
// and the UI (for the dropdown options).

export const CANONICAL_FIELDS = [
  "employee_id",
  "first_name",
  "last_name",
  "date_of_birth",
  "state",
  "zip",
  "annual_salary",
  "hire_date",
  "employment_status",
  "coverage_amount",
  "smoker",
  "dependent_count",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const UNMAPPED = "__unmapped__";
export const NEEDS_SPLIT = "__needs_split__";

export type ProposedField =
  | CanonicalField
  | typeof UNMAPPED
  | typeof NEEDS_SPLIT;

export const REQUIRED_FIELDS: readonly CanonicalField[] = [
  "employee_id",
  "date_of_birth",
  "state",
  "zip",
] as const;

export const FIELD_DESCRIPTIONS: Record<CanonicalField, string> = {
  employee_id:
    "Stable identifier for an employee within the tenant's HR/payroll system. Typically a numeric or alphanumeric string (e.g., 10234, P-88021). Should NOT be SSN.",
  first_name: "Employee's given (first) name.",
  last_name: "Employee's family (last) name.",
  date_of_birth:
    "Employee's birth date. Any parseable date format accepted; value normalization happens downstream.",
  state:
    "US state of employee's residence. Canonical prefers 2-letter USPS code; full-name values require value-level transform.",
  zip: "Postal code for residence. 5-digit or ZIP+4 acceptable.",
  annual_salary:
    "Annualized gross compensation in USD. Hourly, biweekly, or monthly sources map here but require value-level transforms.",
  hire_date:
    "Date the employee started with the employer. Distinct from benefit effective date.",
  employment_status:
    "Current employment state (e.g., Active, Terminated, Leave). NOT schedule (FT/PT) or classification.",
  coverage_amount:
    "Face amount / policy amount of life or disability coverage, in USD.",
  smoker:
    "Binary tobacco/smoker indicator (yes/no). Three-way 'Former' requires tenant-defined reconciliation.",
  dependent_count:
    "Count of dependents covered under the policy. Scope (children-only vs children+spouse) varies by tenant.",
};

export const ALLOWED_OUTPUTS = new Set<string>([
  ...CANONICAL_FIELDS,
  UNMAPPED,
  NEEDS_SPLIT,
]);

export function isCanonicalField(value: string): value is CanonicalField {
  return (CANONICAL_FIELDS as readonly string[]).includes(value);
}

export function confidenceLane(
  confidence: number,
  topDelta?: number,
): "green" | "yellow" | "red" {
  if (typeof topDelta === "number" && topDelta < 10) {
    // Ambiguity forcing function: top-1 and top-2 within 10 points -> yellow regardless.
    if (confidence >= 95) return "yellow";
  }
  if (confidence >= 95) return "green";
  if (confidence >= 70) return "yellow";
  return "red";
}
