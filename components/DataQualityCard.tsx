"use client";

interface Props {
  readyPct: number;
  ignoredPct: number;
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-sm text-zinc-700">{label}</span>
        <span className="font-sans text-sm font-semibold tabular-nums text-zinc-900">
          {Math.round(value)}%
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full bg-zinc-200">
        <div
          className={color}
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: "100%" }}
        />
      </div>
    </div>
  );
}

export function DataQualityCard({ readyPct, ignoredPct }: Props) {
  return (
    <div className="flex flex-col gap-4 border border-zinc-200 bg-white p-5">
      <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-700">
        DATA QUALITY STATS
      </div>
      <Bar label="Mapping Confidence" value={readyPct} color="bg-emerald-500" />
      <Bar label="Ignored / Dropped" value={ignoredPct} color="bg-zinc-500" />
    </div>
  );
}
