import { confidenceLane } from "@/lib/canonical";
import { cn } from "@/lib/ui";

interface Props {
  confidence: number;
  topDelta?: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, topDelta, className }: Props) {
  const lane = confidenceLane(confidence, topDelta);
  const color = {
    green:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-500/30",
    yellow:
      "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-500/30",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-500/30",
  }[lane];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset tabular-nums",
        color,
        className,
      )}
      aria-label={`Confidence ${confidence}%, ${lane} lane`}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          lane === "green" && "bg-emerald-500",
          lane === "yellow" && "bg-amber-500",
          lane === "red" && "bg-rose-500",
        )}
      />
      {confidence}%
    </span>
  );
}
