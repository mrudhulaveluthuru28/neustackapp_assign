"use client";

import { cn } from "@/lib/ui";

interface Props {
  total: number;
  autoMapped: number;
  edited: number;
  unresolved: number;
}

export function StatsBanner({ total, autoMapped, edited, unresolved }: Props) {
  const items = [
    { label: "TOTAL COLUMNS", value: total },
    { label: "AUTO-MAPPED", value: autoMapped },
    { label: "EDITED", value: edited },
    { label: "UNRESOLVED", value: unresolved, showDot: true },
  ];
  return (
    <div className="grid grid-cols-4 border border-zinc-200 bg-white">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn("p-6", i < items.length - 1 && "border-r border-zinc-200")}
        >
          <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
            {item.label}
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-sans text-5xl font-black italic leading-none tracking-tight text-zinc-900">
              {item.value}
            </span>
            {item.showDot && (
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  item.value === 0 ? "bg-emerald-500" : "bg-rose-500",
                )}
                aria-hidden
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
