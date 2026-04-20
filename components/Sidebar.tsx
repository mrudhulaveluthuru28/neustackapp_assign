"use client";

import { GitBranch } from "lucide-react";

interface Props {
  onRunValidation?: () => void;
  meta?: {
    filename?: string;
    source?: "live" | "demo";
    model?: string;
    promptVersion?: string;
    latencyMs?: number;
    columns?: number;
  };
}

export function Sidebar({ onRunValidation, meta }: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="px-6 pt-6 pb-4">
        <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-900">
          EXPLANATION_PANEL
        </div>
        <div className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-zinc-500">
          CONTEXTUAL LOGIC V1.0
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-l-2 border-zinc-900 bg-white px-6 py-2.5 font-mono text-xs font-bold tracking-[0.15em] text-zinc-900">
          <GitBranch className="h-3.5 w-3.5" />
          MAPPING LOGIC
        </div>
      </div>

      {meta && (meta.filename || meta.source) && (
        <div className="mt-6 flex flex-col gap-3 px-6">
          {meta.filename && (
            <MetaRow label="SOURCE FILE" value={meta.filename} mono />
          )}
          {typeof meta.columns === "number" && (
            <MetaRow label="COLUMNS" value={String(meta.columns)} />
          )}
          {meta.source && (
            <MetaRow
              label="RUNTIME"
              value={meta.source === "live" ? "LIVE" : "DEMO"}
            />
          )}
          {meta.model && <MetaRow label="MODEL" value={meta.model} mono />}
          {meta.promptVersion && (
            <MetaRow label="PROMPT" value={meta.promptVersion} mono />
          )}
          {typeof meta.latencyMs === "number" && (
            <MetaRow label="LATENCY" value={`${meta.latencyMs} ms`} />
          )}
        </div>
      )}

      <div className="mt-auto p-6">
        <button
          type="button"
          onClick={onRunValidation}
          className="w-full bg-zinc-900 px-4 py-3 font-mono text-xs font-bold tracking-[0.15em] text-white hover:bg-zinc-800"
        >
          RUN VALIDATION
        </button>
      </div>
    </aside>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.2em] text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xs text-zinc-900 ${mono ? "font-mono truncate" : "font-sans"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
