// Client-side CSV parsing. Extracts headers + up to N non-empty sample values
// per column. Raw row data is kept around so we can emit canonical output
// after approval.

import Papa from "papaparse";

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  columnSamples: Array<{ header: string; samples: string[] }>;
}

const SAMPLES_PER_COLUMN = 5;

export function parseCsvText(text: string): ParsedSheet {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
  });
  if (!result.data.length) {
    return { headers: [], rows: [], columnSamples: [] };
  }
  const [headerRow, ...rows] = result.data;
  const headers = headerRow.map((h) => String(h ?? "").trim());
  const columnSamples = headers.map((header, i) => {
    const samples: string[] = [];
    for (const row of rows) {
      if (samples.length >= SAMPLES_PER_COLUMN) break;
      const v = String(row[i] ?? "").trim();
      if (v.length > 0) samples.push(v);
    }
    return { header, samples };
  });
  return { headers, rows, columnSamples };
}

export async function parseCsvFile(file: File): Promise<ParsedSheet> {
  const text = await file.text();
  return parseCsvText(text);
}

export async function fetchAndParseCsv(url: string): Promise<ParsedSheet> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  return parseCsvText(text);
}
