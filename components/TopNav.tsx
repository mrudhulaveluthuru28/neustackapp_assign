"use client";

import { cn } from "@/lib/ui";
import type { StepId } from "./Stepper";

interface Props {
  active: StepId;
  onNavigate?: (step: StepId) => void;
}

const NAV: Array<{ id: StepId; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Map" },
  { id: "review", label: "Review" },
  { id: "publish", label: "Publish" },
];

export function TopNav({ active, onNavigate }: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="flex items-center justify-between px-8 py-4">
        <div className="font-mono text-sm font-bold tracking-[0.15em] text-zinc-900">
          AI_MAPPING_COPILOT
        </div>
        <nav className="flex items-center gap-8">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={cn(
                "text-sm transition-colors",
                item.id === active
                  ? "font-semibold text-zinc-900 underline underline-offset-8 decoration-2"
                  : "text-zinc-400 hover:text-zinc-600",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 font-mono text-[10px] font-bold tracking-wider text-white">
          AI
        </div>
      </div>
    </header>
  );
}
