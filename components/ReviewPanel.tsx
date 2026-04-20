"use client";

import { confidenceLane, type ProposedField } from "@/lib/canonical";
import type { Proposal } from "@/lib/types";
import { ColumnCard } from "./ColumnCard";

export interface ReviewEntry {
  proposal: Proposal;
  effective_field: ProposedField;
  ignored: boolean;
}

interface Props {
  entries: ReviewEntry[];
  onChangeField: (header: string, field: ProposedField) => void;
  onToggleIgnore: (header: string) => void;
}

function laneOf(entry: ReviewEntry): "green" | "yellow" | "red" {
  const topDelta =
    entry.proposal.alternatives && entry.proposal.alternatives.length > 0
      ? entry.proposal.confidence - entry.proposal.alternatives[0].confidence
      : undefined;
  return confidenceLane(entry.proposal.confidence, topDelta);
}

const LANES: Array<{
  key: "red" | "yellow" | "green";
  title: string;
  description: string;
  color: string;
}> = [
  {
    key: "red",
    title: "Needs decision",
    description: "Confidence below 70%. Publish is blocked until these are resolved.",
    color: "border-rose-200 dark:border-rose-900/50",
  },
  {
    key: "yellow",
    title: "Review",
    description: "Confidence 70–94% or ambiguous. Confirm before publish.",
    color: "border-amber-200 dark:border-amber-900/50",
  },
  {
    key: "green",
    title: "Ready",
    description: "Confidence ≥ 95%. Pre-accepted; edit if needed.",
    color: "border-emerald-200 dark:border-emerald-900/50",
  },
];

export function ReviewPanel({ entries, onChangeField, onToggleIgnore }: Props) {
  const byLane: Record<"red" | "yellow" | "green", ReviewEntry[]> = {
    red: [],
    yellow: [],
    green: [],
  };
  for (const e of entries) {
    if (e.ignored) {
      byLane.green.push(e); // collapsed visually inside the card
      continue;
    }
    byLane[laneOf(e)].push(e);
  }

  return (
    <div className="space-y-6">
      {LANES.map((lane) => {
        const items = byLane[lane.key];
        if (items.length === 0) return null;
        return (
          <section
            key={lane.key}
            className={`rounded-lg border bg-white/60 p-4 dark:bg-zinc-950/60 ${lane.color}`}
          >
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {lane.title}
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                    · {items.length}
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {lane.description}
                </p>
              </div>
            </header>
            <div className="space-y-3">
              {items.map((e) => (
                <ColumnCard
                  key={e.proposal.source_header}
                  proposal={e.proposal}
                  effectiveField={e.effective_field}
                  ignored={e.ignored}
                  onChangeField={(f) =>
                    onChangeField(e.proposal.source_header, f)
                  }
                  onToggleIgnore={() =>
                    onToggleIgnore(e.proposal.source_header)
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
