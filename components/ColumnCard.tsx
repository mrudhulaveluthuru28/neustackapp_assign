"use client";

import { AlertTriangle, EyeOff, Eye } from "lucide-react";
import {
  NEEDS_SPLIT,
  UNMAPPED,
  type ProposedField,
} from "@/lib/canonical";
import type { Proposal } from "@/lib/types";
import { cn } from "@/lib/ui";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FieldSelect } from "./FieldSelect";

interface Props {
  proposal: Proposal;
  effectiveField: ProposedField;
  ignored: boolean;
  onChangeField: (value: ProposedField) => void;
  onToggleIgnore: () => void;
}

function fieldLabel(f: ProposedField): string {
  if (f === UNMAPPED) return "Unmapped";
  if (f === NEEDS_SPLIT) return "Needs split";
  return f;
}

export function ColumnCard({
  proposal,
  effectiveField,
  ignored,
  onChangeField,
  onToggleIgnore,
}: Props) {
  const topDelta =
    proposal.alternatives && proposal.alternatives.length > 0
      ? proposal.confidence - proposal.alternatives[0].confidence
      : undefined;

  const edited = effectiveField !== proposal.proposed_field;

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 transition-colors",
        "dark:border-zinc-800 dark:bg-zinc-950",
        ignored && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {proposal.source_header}
            </h3>
            <ConfidenceBadge
              confidence={proposal.confidence}
              topDelta={topDelta}
            />
            {edited && (
              <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-500/30">
                Edited
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Samples:{" "}
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {proposal.samples.length > 0
                ? proposal.samples.slice(0, 4).join(", ")
                : "(none)"}
              {proposal.samples.length > 4 && " …"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleIgnore}
          className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
          aria-label={ignored ? "Include column" : "Ignore column"}
        >
          {ignored ? (
            <>
              <Eye className="h-3.5 w-3.5" /> Include
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" /> Ignore
            </>
          )}
        </button>
      </div>

      <p className="mt-3 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
        {proposal.rationale}
      </p>

      {proposal.value_warning && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{proposal.value_warning}</span>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr] sm:items-center">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Map to
          </label>
          <FieldSelect
            value={effectiveField}
            onChange={onChangeField}
            disabled={ignored}
            className="mt-1"
          />
        </div>
        {proposal.alternatives && proposal.alternatives.length > 0 && (
          <div className="min-w-0">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Alternatives
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {proposal.alternatives.map((alt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChangeField(alt.field)}
                  disabled={ignored}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs font-mono text-zinc-700 hover:border-zinc-400 hover:bg-white disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-950"
                >
                  {fieldLabel(alt.field)}
                  <span className="text-zinc-400">{alt.confidence}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {effectiveField === NEEDS_SPLIT && (
        <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-400">
          Publishing splits this column into{" "}
          <code className="text-zinc-700 dark:text-zinc-300">first_name</code> +{" "}
          <code className="text-zinc-700 dark:text-zinc-300">last_name</code>{" "}
          (naive whitespace split; review output before shipping downstream).
        </p>
      )}
    </div>
  );
}
