"use client";

import { cn } from "@/lib/ui";

export type StepId = "upload" | "map" | "review" | "publish";

const STEPS: Array<{ id: StepId; n: number; label: string }> = [
  { id: "upload", n: 1, label: "UPLOAD" },
  { id: "map", n: 2, label: "MAP" },
  { id: "review", n: 3, label: "REVIEW" },
  { id: "publish", n: 4, label: "PUBLISH" },
];

interface Props {
  active: StepId;
  className?: string;
}

export function Stepper({ active, className }: Props) {
  const activeIdx = STEPS.findIndex((s) => s.id === active);
  return (
    <nav
      className={cn("flex items-start justify-center", className)}
      aria-label="Progress"
    >
      {STEPS.map((step, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <div key={step.id} className="flex items-start">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center font-mono text-sm font-bold tabular-nums",
                  (isActive || isDone) && "bg-zinc-900 text-white",
                  !isActive && !isDone && "border border-zinc-300 bg-white text-zinc-400",
                )}
              >
                {step.n}
              </div>
              <span
                className={cn(
                  "font-mono text-[10px] tracking-[0.2em]",
                  isActive ? "font-bold text-zinc-900" : "text-zinc-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-4 mt-4 h-px w-24 bg-zinc-300" aria-hidden />
            )}
          </div>
        );
      })}
    </nav>
  );
}
