"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui";
import type { ReviewEntry } from "./ReviewPanel";

interface Props {
  entries: ReviewEntry[];
}

// A deliberately simple value-distribution chart. In a real product this would
// show per-column null rates, type histograms, cardinality, etc.; here it
// visualizes confidence across columns so the reviewer sees mapping quality at
// a glance.
export function SourceDataProfile({ entries }: Props) {
  const bars = entries.map((e) => ({
    header: e.proposal.source_header,
    value: e.proposal.confidence,
  }));
  const max = 100;
  return (
    <div className="flex h-full flex-col border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-700">
          SOURCE DATA PROFILE
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
      </div>
      <div className="mt-6 flex h-32 items-end gap-2">
        {bars.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            upload a sheet to see distribution
          </div>
        ) : (
          bars.map((b, i) => {
            const h = Math.max(8, (b.value / max) * 100);
            const shade =
              b.value >= 95
                ? "bg-zinc-900"
                : b.value >= 70
                  ? "bg-zinc-500"
                  : "bg-zinc-300";
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${b.header}: ${b.value}%`}
              >
                <div
                  className={cn("w-full", shade)}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })
        )}
      </div>
      <div className="mt-4 font-mono text-[10px] tracking-[0.15em] text-zinc-400">
        VALUE DISTRIBUTION: CONFIDENCE ACROSS COLUMNS
      </div>
    </div>
  );
}
