// Demo-mode fixture loader. When the server has no ANTHROPIC_API_KEY (or the
// client explicitly requests demo mode), we return pre-baked proposals keyed
// by source header. This keeps the reviewer's first click-through zero-config.

import fs from "node:fs/promises";
import path from "node:path";
import type { Proposal } from "./types";
import { scrubSamples } from "./pii-scrub";
import { UNMAPPED } from "./canonical";

let CACHED: Map<string, Proposal> | null = null;

async function loadCache(): Promise<Map<string, Proposal>> {
  if (CACHED) return CACHED;
  const map = new Map<string, Proposal>();
  const dir = path.join(process.cwd(), "public", "fixtures");
  for (const file of ["sheet_a_proposals.json", "sheet_b_proposals.json"]) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const parsed = JSON.parse(raw) as Proposal[];
      for (const p of parsed) {
        map.set(p.source_header.toLowerCase().trim(), p);
      }
    } catch {
      // Missing fixture file is non-fatal in demo mode; the fallback below kicks in.
    }
  }
  CACHED = map;
  return map;
}

export async function loadDemoFixtures(
  columns: Array<{ header: string; samples: string[] }>,
): Promise<Proposal[]> {
  const cache = await loadCache();
  return columns.map(({ header, samples }) => {
    const scrubbed = scrubSamples(samples);
    const hit = cache.get(header.toLowerCase().trim());
    if (hit) {
      return { ...hit, samples: scrubbed };
    }
    return {
      source_header: header,
      samples: scrubbed,
      proposed_field: UNMAPPED,
      confidence: 20,
      rationale:
        "Demo mode: no pre-baked fixture for this header. Set ANTHROPIC_API_KEY for live proposals.",
    };
  });
}
