"use client";

import { AlertTriangle } from "lucide-react";

interface Props {
  count: number;
  label?: string;
  onDismiss?: () => void;
}

export function AlertBanner({ count, label, onDismiss }: Props) {
  if (count === 0) return null;
  const text =
    label ??
    `${count} field${count === 1 ? "" : "s"} need review before proceeding`;
  return (
    <div className="flex items-center justify-between gap-3 border-l-4 border-zinc-900 bg-zinc-100 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-zinc-900" />
        <span className="text-sm text-zinc-900">{text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="border border-zinc-300 bg-white px-4 py-1.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-zinc-700 hover:bg-zinc-50"
        >
          DISMISS
        </button>
      )}
    </div>
  );
}
