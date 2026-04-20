// Regenerates demo-mode proposal fixtures by calling the running /api/propose
// endpoint with each eval sheet. The running dev server must have
// ANTHROPIC_API_KEY set (via .env.local), otherwise it falls back to the
// existing hand-crafted fixtures and this script is a no-op.
//
// Usage:  node scripts/regenerate-fixtures.mjs

import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

const PORT = process.env.PORT || "3001";
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

async function parseCsv(filepath) {
  const text = await fs.readFile(filepath, "utf-8");
  const parsed = Papa.parse(text, { skipEmptyLines: true });
  const [headerRow, ...rows] = parsed.data;
  return headerRow.map((header, i) => {
    const samples = [];
    for (const row of rows) {
      if (samples.length >= 5) break;
      const v = String(row[i] ?? "").trim();
      if (v) samples.push(v);
    }
    return { header: String(header).trim(), samples };
  });
}

async function regenerate(sheetName, csvPath, outPath, transcriptPath) {
  const columns = await parseCsv(csvPath);
  process.stdout.write(
    `[${sheetName}] calling /api/propose with ${columns.length} columns... `,
  );
  const started = Date.now();
  const res = await fetch(`${BASE}/api/propose`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ columns }),
  });
  if (!res.ok) {
    console.error(`\nHTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  const wall = Date.now() - started;
  console.log(
    `source=${data.source}, model=${data.model}, server_latency=${data.latency_ms}ms, wall=${wall}ms`,
  );
  if (data.source !== "live") {
    console.error(
      `  ! server returned demo mode — ANTHROPIC_API_KEY may not be set in the dev-server process. Restart dev server.`,
    );
    process.exit(2);
  }

  await fs.writeFile(outPath, JSON.stringify(data.proposals, null, 2) + "\n");
  await fs.writeFile(
    transcriptPath,
    JSON.stringify(
      {
        sheet: sheetName,
        csv: path.relative(ROOT, csvPath),
        source: data.source,
        model: data.model,
        prompt_version: data.prompt_version,
        latency_ms: data.latency_ms,
        generated_at: new Date().toISOString(),
        columns,
        proposals: data.proposals,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`  wrote ${path.relative(ROOT, outPath)}`);
  console.log(`  wrote ${path.relative(ROOT, transcriptPath)}`);
  return data;
}

const sheetA = await regenerate(
  "Sheet A",
  path.join(ROOT, "fixtures/sheet_a.csv"),
  path.join(ROOT, "public/fixtures/sheet_a_proposals.json"),
  path.join(ROOT, "fixtures/sheet_a_transcript.json"),
);

const sheetB = await regenerate(
  "Sheet B",
  path.join(ROOT, "fixtures/sheet_b.csv"),
  path.join(ROOT, "public/fixtures/sheet_b_proposals.json"),
  path.join(ROOT, "fixtures/sheet_b_transcript.json"),
);

// Quick accuracy snapshot against gold mappings
async function scoreAgainstGold(sheetName, proposals, goldPath) {
  const goldRaw = await fs.readFile(goldPath, "utf-8");
  const gold = JSON.parse(goldRaw);
  let correct = 0;
  let total = 0;
  const misses = [];
  for (const p of proposals) {
    const goldField = gold[p.source_header];
    if (goldField == null) continue;
    total += 1;
    if (goldField === p.proposed_field) correct += 1;
    else misses.push({ header: p.source_header, gold: goldField, proposed: p.proposed_field, conf: p.confidence });
  }
  console.log(`\n[${sheetName}] top-1 accuracy: ${correct}/${total} = ${((100 * correct) / total).toFixed(1)}%`);
  if (misses.length > 0) {
    console.log(`  misses:`);
    for (const m of misses) {
      console.log(`    ${m.header.padEnd(20)}  gold=${m.gold}  proposed=${m.proposed} (conf=${m.conf})`);
    }
  }
  return { correct, total, misses };
}

await scoreAgainstGold(
  "Sheet A",
  sheetA.proposals,
  path.join(ROOT, "fixtures/sheet_a_gold.json"),
);
await scoreAgainstGold(
  "Sheet B",
  sheetB.proposals,
  path.join(ROOT, "fixtures/sheet_b_gold.json"),
);
