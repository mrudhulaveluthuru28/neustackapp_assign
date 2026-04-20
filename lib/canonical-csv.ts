// Emits canonical output from the user-approved mapping decisions + original
// CSV rows. Handles one-to-one, ignored, unmapped, and needs_split cases.

import Papa from "papaparse";
import {
  CANONICAL_FIELDS,
  NEEDS_SPLIT,
  UNMAPPED,
  type CanonicalField,
  type ProposedField,
} from "./canonical";

export interface ColumnDecision {
  source_header: string;
  effective_field: ProposedField;
  split_targets?: CanonicalField[];
  ignored: boolean;
}

export interface BuildCanonicalInput {
  headers: string[];
  rows: string[][];
  decisions: ColumnDecision[];
}

export interface BuildCanonicalOutput {
  canonicalCsv: string;
  mappingJson: string;
  stats: {
    rows: number;
    mapped_columns: number;
    unmapped_columns: number;
    ignored_columns: number;
    split_columns: number;
    missing_required: CanonicalField[];
  };
}

const REQUIRED: readonly CanonicalField[] = [
  "employee_id",
  "date_of_birth",
  "state",
  "zip",
];

function naiveSplitFullName(value: string): { first: string; last: string } {
  const trimmed = value.trim();
  if (!trimmed) return { first: "", last: "" };
  // Keep this intentionally simple; value-level transforms are out of scope.
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) return { first: tokens[0], last: "" };
  if (tokens.length === 2) return { first: tokens[0], last: tokens[1] };
  // 3+ tokens: first token is first_name, last token is last_name; drop
  // middle initials / suffixes into last_name to keep lossless.
  return {
    first: tokens[0],
    last: tokens.slice(1).join(" "),
  };
}

export function buildCanonical(
  input: BuildCanonicalInput,
): BuildCanonicalOutput {
  const { headers, rows, decisions } = input;

  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[h] = i;
  });

  const activeDecisions = decisions.filter(
    (d) => !d.ignored && d.effective_field !== UNMAPPED,
  );

  const canonicalRows: Record<CanonicalField, string>[] = rows.map((row) => {
    const out: Partial<Record<CanonicalField, string>> = {};
    for (const decision of activeDecisions) {
      const idx = headerIndex[decision.source_header];
      if (idx == null) continue;
      const value = String(row[idx] ?? "").trim();

      if (decision.effective_field === NEEDS_SPLIT) {
        const targets = decision.split_targets ?? ["first_name", "last_name"];
        if (targets.length === 2 && targets[0] === "first_name") {
          const { first, last } = naiveSplitFullName(value);
          if (!out.first_name) out.first_name = first;
          if (!out.last_name) out.last_name = last;
        }
        continue;
      }

      const field = decision.effective_field as CanonicalField;
      if (!out[field]) out[field] = value;
    }
    // Ensure every canonical field column exists, even if empty.
    const filled: Record<CanonicalField, string> = {} as Record<
      CanonicalField,
      string
    >;
    for (const f of CANONICAL_FIELDS) {
      filled[f] = out[f] ?? "";
    }
    return filled;
  });

  const csv = Papa.unparse({
    fields: [...CANONICAL_FIELDS],
    data: canonicalRows.map((r) => CANONICAL_FIELDS.map((f) => r[f])),
  });

  const mappedColumns = activeDecisions.filter(
    (d) => d.effective_field !== NEEDS_SPLIT,
  ).length;
  const splitColumns = activeDecisions.filter(
    (d) => d.effective_field === NEEDS_SPLIT,
  ).length;
  const ignoredColumns = decisions.filter((d) => d.ignored).length;
  const unmappedColumns = decisions.filter(
    (d) => !d.ignored && d.effective_field === UNMAPPED,
  ).length;

  const touchedFields = new Set<string>();
  for (const d of activeDecisions) {
    if (d.effective_field === NEEDS_SPLIT) {
      (d.split_targets ?? ["first_name", "last_name"]).forEach((t) =>
        touchedFields.add(t),
      );
    } else {
      touchedFields.add(d.effective_field);
    }
  }
  const missingRequired = REQUIRED.filter((f) => !touchedFields.has(f));

  const mapping = {
    canonical_schema: [...CANONICAL_FIELDS],
    decisions: decisions.map((d) => ({
      source_header: d.source_header,
      mapped_to: d.ignored ? "__ignored__" : d.effective_field,
      split_targets: d.split_targets ?? null,
    })),
    stats: {
      rows: rows.length,
      mapped_columns: mappedColumns,
      split_columns: splitColumns,
      unmapped_columns: unmappedColumns,
      ignored_columns: ignoredColumns,
      missing_required: missingRequired,
    },
    generated_at: new Date().toISOString(),
  };

  return {
    canonicalCsv: csv,
    mappingJson: JSON.stringify(mapping, null, 2),
    stats: {
      rows: rows.length,
      mapped_columns: mappedColumns,
      unmapped_columns: unmappedColumns,
      ignored_columns: ignoredColumns,
      split_columns: splitColumns,
      missing_required: missingRequired,
    },
  };
}

export function downloadText(
  filename: string,
  text: string,
  mime: string,
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
