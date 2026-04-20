"use client";

import { cn } from "@/lib/ui";
import {
  confidenceLane,
  NEEDS_SPLIT,
  UNMAPPED,
  type ProposedField,
} from "@/lib/canonical";
import type { ReviewEntry } from "./ReviewPanel";

interface Props {
  entries: ReviewEntry[];
  selectedHeader: string | null;
  onSelect: (header: string) => void;
  onAccept: (header: string) => void;
}

function displayField(f: ProposedField): string {
  if (f === UNMAPPED) return "— unmapped —";
  if (f === NEEDS_SPLIT) return "first_name + last_name";
  return f;
}

function laneDot(lane: "green" | "yellow" | "red") {
  return {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-rose-500",
  }[lane];
}

export function MappingTable({
  entries,
  selectedHeader,
  onSelect,
  onAccept,
}: Props) {
  return (
    <div className="border border-zinc-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.15em] text-zinc-600">
              SOURCE COLUMN
            </th>
            <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.15em] text-zinc-600">
              SAMPLE VALUES
            </th>
            <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.15em] text-zinc-600">
              SUGGESTED MAPPING
            </th>
            <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.15em] text-zinc-600">
              CONFIDENCE
            </th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const topDelta =
              e.proposal.alternatives && e.proposal.alternatives.length > 0
                ? e.proposal.confidence - e.proposal.alternatives[0].confidence
                : undefined;
            const lane = confidenceLane(e.proposal.confidence, topDelta);
            const isSelected = selectedHeader === e.proposal.source_header;
            const edited =
              e.effective_field !== e.proposal.proposed_field && !e.ignored;
            return (
              <tr
                key={e.proposal.source_header}
                onClick={() => onSelect(e.proposal.source_header)}
                className={cn(
                  "cursor-pointer border-b border-zinc-100 transition-colors",
                  isSelected ? "bg-zinc-50" : "hover:bg-zinc-50/60",
                  e.ignored && "opacity-50",
                )}
              >
                <td className="px-5 py-3.5">
                  <span className="font-mono text-sm text-zinc-900">
                    {e.proposal.source_header}
                  </span>
                  {edited && (
                    <span className="ml-2 font-mono text-[9px] tracking-wider text-sky-600">
                      EDITED
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">
                  {e.proposal.samples.length > 0
                    ? e.proposal.samples
                        .slice(0, 2)
                        .map((s) => `'${s}'`)
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-sans text-sm font-semibold text-zinc-900">
                    {displayField(e.effective_field)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        laneDot(lane),
                      )}
                    />
                    <span className="font-sans text-sm tabular-nums text-zinc-700">
                      {(e.proposal.confidence / 100).toFixed(2)}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onAccept(e.proposal.source_header);
                    }}
                    className="bg-zinc-900 px-4 py-1.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-white hover:bg-zinc-700"
                  >
                    ACCEPT
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
