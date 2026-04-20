"use client";

import {
  CANONICAL_FIELDS,
  FIELD_DESCRIPTIONS,
  NEEDS_SPLIT,
  UNMAPPED,
  type ProposedField,
} from "@/lib/canonical";
import { cn } from "@/lib/ui";

interface Props {
  value: ProposedField;
  onChange: (value: ProposedField) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const LABELS: Record<string, string> = {
  __unmapped__: "— Unmapped —",
  __needs_split__: "Needs split (first + last name)",
};

export function FieldSelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: Props) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ProposedField)}
      className={cn(
        "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900",
        "focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500",
        className,
      )}
    >
      <optgroup label="Canonical fields">
        {CANONICAL_FIELDS.map((f) => (
          <option key={f} value={f} title={FIELD_DESCRIPTIONS[f]}>
            {f}
          </option>
        ))}
      </optgroup>
      <optgroup label="Special">
        <option value={UNMAPPED}>{LABELS[UNMAPPED]}</option>
        <option value={NEEDS_SPLIT}>{LABELS[NEEDS_SPLIT]}</option>
      </optgroup>
    </select>
  );
}
