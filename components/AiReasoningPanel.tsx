"use client";

import { AlertTriangle, Check, Flag, Lightbulb } from "lucide-react";
import { cn } from "@/lib/ui";
import type { Proposal } from "@/lib/types";
import type { ProposedField } from "@/lib/canonical";
import { FieldSelect } from "./FieldSelect";

interface Props {
  proposal: Proposal | null;
  effectiveField: ProposedField | null;
  onChangeField: (f: ProposedField) => void;
  onAccept: () => void;
  onToggleIgnore: () => void;
  ignored: boolean;
}

export function AiReasoningPanel({
  proposal,
  effectiveField,
  onChangeField,
  onAccept,
  onToggleIgnore,
  ignored,
}: Props) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex items-center gap-1.5 border-b border-zinc-900 px-5 pb-3 pt-5">
        <Lightbulb className="h-3.5 w-3.5 text-zinc-900" />
        <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-zinc-900">
          AI REASONING &amp; LOGIC
        </span>
      </div>

      {!proposal || !effectiveField ? (
        <div className="p-5 text-sm text-zinc-400">
          Select a row to see the reasoning.
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-5">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              SOURCE KEY
            </div>
            <div className="mt-1 font-mono text-sm text-zinc-900">
              {proposal.source_header}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              WHY AI CHOSE THIS
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {proposal.rationale}
            </p>
          </div>

          {proposal.alternatives && proposal.alternatives.length > 0 && (
            <div className="border border-zinc-200 p-3">
              <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-500">
                ALTERNATIVE OPTIONS
              </div>
              <div className="flex flex-col gap-1.5">
                {proposal.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeField(alt.field)}
                      className="font-mono text-zinc-800 hover:underline"
                    >
                      {alt.field}
                    </button>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {(alt.confidence / 100).toFixed(2)} confidence
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {proposal.value_warning && (
            <div className="border-l-4 border-rose-600 bg-rose-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Ambiguity warning
              </div>
              <p className="mt-1.5 text-xs leading-snug text-rose-900">
                {proposal.value_warning}
              </p>
            </div>
          )}

          <div>
            <div className="mb-1 font-mono text-[10px] tracking-[0.18em] text-zinc-500">
              MAP TO
            </div>
            <FieldSelect
              value={effectiveField}
              onChange={onChangeField}
              disabled={ignored}
            />
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={onAccept}
              disabled={ignored}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 bg-zinc-900 py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Check className="h-3.5 w-3.5" /> ACCEPT SUGGESTION
            </button>
            <button
              type="button"
              onClick={onToggleIgnore}
              className="flex w-full items-center justify-center gap-1.5 border border-zinc-300 bg-white py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-zinc-700 hover:bg-zinc-50"
            >
              <Flag className="h-3.5 w-3.5" />
              {ignored ? "INCLUDE COLUMN" : "REPORT MISALIGNMENT"}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
