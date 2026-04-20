"use client";

import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/ui";
import { fetchAndParseCsv, type ParsedSheet } from "@/lib/csv-utils";

interface Props {
  onParsed: (sheet: ParsedSheet, filename: string, source: "demo") => void;
  disabled?: boolean;
}

const DEMOS = [
  {
    key: "a",
    label: "ACME Brokerage Census",
    sub: "12 cols · 4 ambiguous · broker file",
    url: "/fixtures/sheet_a.csv",
    filename: "sheet_a.csv",
  },
  {
    key: "b",
    label: "HRIS Export Q1 2026",
    sub: "14 cols · 9 ambiguous · full-name split, hourly rates, FT/PT traps",
    url: "/fixtures/sheet_b.csv",
    filename: "sheet_b.csv",
  },
];

export function DemoLoader({ onParsed, disabled }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {DEMOS.map((d) => (
        <button
          key={d.key}
          type="button"
          disabled={disabled}
          onClick={async () => {
            const parsed = await fetchAndParseCsv(d.url);
            onParsed(parsed, d.filename, "demo");
          }}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50",
            "dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {d.label}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {d.sub}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
