"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/ui";
import { parseCsvFile, type ParsedSheet } from "@/lib/csv-utils";

interface Props {
  onParsed: (sheet: ParsedSheet, filename: string) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onParsed, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Please upload a .csv file (XLSX support in v2).");
        return;
      }
      try {
        const parsed = await parseCsvFile(file);
        if (!parsed.headers.length) {
          setError("No columns detected. Is this a valid CSV?");
          return;
        }
        onParsed(parsed, file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    },
    [onParsed],
  );

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) await handleFile(file);
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-white",
          "dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
          dragOver && "border-zinc-500 bg-white dark:border-zinc-500 dark:bg-zinc-900",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="h-6 w-6 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Drop a CSV here or click to browse
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Census / enrollment file with header row. Values never leave your
          browser unscrubbed.
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
