"use client";

import { Download, RefreshCcw, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/ui";
import type { CanonicalField } from "@/lib/canonical";

interface Props {
  filename: string;
  source: "live" | "demo";
  model: string;
  latencyMs: number;
  counts: {
    total: number;
    ready: number;
    review: number;
    blocked: number;
    ignored: number;
  };
  missingRequired: CanonicalField[];
  onPublish: () => void;
  onReset: () => void;
  publishing: boolean;
}

export function PublishBar({
  filename,
  source,
  model,
  latencyMs,
  counts,
  missingRequired,
  onPublish,
  onReset,
  publishing,
}: Props) {
  const blockedByRequired = missingRequired.length > 0;
  const blockedByLane = counts.blocked > 0;
  const disabled = blockedByRequired || blockedByLane || publishing;

  const reason = blockedByLane
    ? `${counts.blocked} column${counts.blocked === 1 ? "" : "s"} in the red lane. Resolve or ignore before publishing.`
    : blockedByRequired
      ? `Missing required field${missingRequired.length === 1 ? "" : "s"}: ${missingRequired.join(", ")}.`
      : null;

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[180px]">
              {filename}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                source === "live"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-500/30"
                  : "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-500/30",
              )}
            >
              {source === "live" ? "Live" : "Demo"}
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                {model}
              </span>
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {latencyMs} ms
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {counts.ready}
              </span>{" "}
              ready
            </span>
            <span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {counts.review}
              </span>{" "}
              review
            </span>
            <span>
              <span className="font-medium text-rose-600 dark:text-rose-400">
                {counts.blocked}
              </span>{" "}
              blocked
            </span>
            <span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {counts.ignored}
              </span>{" "}
              ignored
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Start over
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              "bg-zinc-900 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50",
              "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            )}
          >
            <Download className="h-3.5 w-3.5" />
            {publishing ? "Publishing…" : "Publish canonical CSV"}
          </button>
        </div>
      </div>
      {reason && (
        <div className="mx-auto mt-2 flex max-w-5xl items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-200">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{reason}</span>
        </div>
      )}
    </div>
  );
}
