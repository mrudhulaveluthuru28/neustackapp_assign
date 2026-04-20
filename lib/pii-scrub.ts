// Pattern-preserving PII scrubber. Values are replaced with shape tokens so the
// LLM sees format (helpful for classification) but never the raw PII. Applied
// before any sample value leaves our VPC.

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Formatted SSN: 123-45-6789
  [/\b\d{3}-\d{2}-\d{4}\b/g, "NNN-NN-NNNN"],
  // Unformatted 9-digit block that looks like an SSN (be conservative: only
  // replace if the surrounding value is purely 9 digits)
  [/^\d{9}$/g, "NNNNNNNNN"],
  // Email
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "EMAIL"],
  // North American phone numbers in several common shapes
  [/\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "PHONE"],
];

// Values we explicitly do NOT want to mask as names, even though they are
// Title Case single/few-word strings.
const NON_NAME_ALLOW = new Set<string>([
  "Active",
  "Terminated",
  "Termed",
  "Leave",
  "On Leave",
  "Pending",
  "Yes",
  "No",
  "Y",
  "N",
  "FT",
  "PT",
  "Full Time",
  "Part Time",
  "Never",
  "Former",
  "Current",
  "Male",
  "Female",
  "Other",
  "Married",
  "Single",
]);

// Full US state names kept as-is: they're frequent column values and not PII.
const US_STATES_FULL = new Set<string>([
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
]);

// 1–3 Title Case tokens, allowing internal hyphens, apostrophes, periods
// (e.g., "Jr."). Handles "John Q Smith", "Maria Garcia Jr.", "Dana Wu-Nakamura".
const NAME_REGEX = /^[A-Z][A-Za-z\-'.]{0,29}(\s+[A-Z][A-Za-z\-'.]{0,29}){0,3}$/;

function looksLikeName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (NON_NAME_ALLOW.has(trimmed)) return false;
  if (US_STATES_FULL.has(trimmed)) return false;
  // Pure numeric-ish values aren't names.
  if (/^\d/.test(trimmed)) return false;
  return NAME_REGEX.test(trimmed);
}

export function scrubValue(value: unknown): string {
  let v = String(value ?? "");
  for (const [re, token] of PATTERNS) {
    v = v.replace(re, token);
  }
  if (looksLikeName(v)) v = "NAME";
  return v;
}

export function scrubSamples(values: unknown[]): string[] {
  return values.map(scrubValue);
}

// Exported for tests / debugging.
export const __testing = { looksLikeName, PATTERNS };
