# AI Mapping Copilot

> Map messy insurance census spreadsheets to a canonical 12-field schema. LLM-proposed mappings with calibrated confidence, human-in-the-loop review, and PII-safe sample handling.

**Live:** <https://neustackapp-assign.vercel.app/>

---

## What it does

Insurance operations teams onboard census files from brokers, HR systems, and direct uploads. Every sender uses different column names for the same concepts — `DOB` vs `Birth Dt` vs `BDate`, `Salary` vs `Base Comp` vs `Annual Pay` — and an analyst has to hand-map every upload before downstream systems can use the data.

This app automates the proposal step while keeping the human on the approval hook:

1. **Upload** a CSV (or click a sample sheet).
2. **Claude** proposes a canonical field per source column, with a confidence score, a one-sentence rationale, up to two alternative candidates, and value-format warnings when a mapping is correct but the values still need transformation (hourly → annual, 3-way smoker → binary, etc.).
3. **Review** in a three-lane UI (Ready / Review / Needs decision). Edit any mapping via a dropdown over the canonical schema; flag a column as Ignore; or accept as-is.
4. **Publish** — produces a canonical-schema CSV plus an audit JSON with the full mapping decision log.

The canonical schema is 12 fields: `employee_id, first_name, last_name, date_of_birth, state, zip, annual_salary, hire_date, employment_status, coverage_amount, smoker, dependent_count`. The LLM is constrained to this closed vocabulary via tool-use so it cannot invent fields.

## Run it locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

Click **Try ACME Brokerage Census** or **Try HRIS Export Q1 2026** to run the end-to-end flow without any setup. The server uses pre-baked proposals when no API key is present, so the demo works offline.

## Run with live Claude

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

With the env var set, `/api/propose` sends pre-scrubbed column samples to `claude-sonnet-4-6` using tool-use for structured output. Temperature 0, ephemeral prompt caching on the system block. Without the var, the route transparently falls back to the demo fixtures.

## Deploy

```bash
npm i -g vercel
vercel
vercel --prod
```

Set `ANTHROPIC_API_KEY` in **Project → Settings → Environment Variables (Production)**.

## Architecture

```
Browser ── upload or demo click ──► papaparse ──► { headers, rows, samples }
                                                       │
                                                       ▼ POST /api/propose
Route handler (lib/pii-scrub → lib/prompt → Anthropic SDK)
  - scrub PII shape-tokens (SSN / email / phone / name heuristic)
  - per-column isolation (Promise.all fan-out, temperature 0)
  - tool-use with closed-vocab enum (no field invention)
  - fallback to demo fixtures if no API key
                                                       │
                                                       ▼ { proposals, model, latency, source }
Review UI
  - three-lane layout (ready / review / needs decision)
  - per-row rationale, alternatives, edit dropdown, ignore toggle
  - AI reasoning panel on select
                                                       │
                                                       ▼ publish
lib/canonical-csv.ts ──► canonical CSV + audit JSON download
```

Key modules:

| Path | Purpose |
|---|---|
| `lib/canonical.ts` | 12-field schema, required-fields list, confidence-lane classifier |
| `lib/prompt.ts` | Pinned system prompt (`mapping-v1.0.0`) + tool JSON schema |
| `lib/pii-scrub.ts` | Pattern-preserving scrubber (SSN, email, phone, Title-Case name heuristic) |
| `lib/demo-fixtures.ts` | Pre-baked proposals loader for offline mode |
| `lib/canonical-csv.ts` | Canonical CSV generator + audit JSON; naïve full-name splitter |
| `app/api/propose/route.ts` | Route handler; per-column LLM call with fallback |
| `app/page.tsx` | 5-phase state machine (idle → proposing → mapping → review → published) |
| `components/*` | Review UI (Stepper, MappingTable, AiReasoningPanel, StatsBanner, …) |
| `scripts/regenerate-fixtures.mjs` | Re-runs the live LLM pass against the sample sheets; writes proposals + full transcripts |

## Stack

- **Next.js 16.2** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Tailwind CSS 4** (CSS-based theming via `@theme`)
- **Anthropic SDK** with tool-use structured output + ephemeral prompt caching
- **Papa Parse** for CSV parse / serialize
- **Zod** (installed, reserved for runtime boundary validation in v2)
- **Lucide** icons

## Guardrails

- **Closed vocabulary** — tool-use enum rejects any out-of-schema field before the model's output hits our code.
- **Per-column isolation** — one LLM call per column, parallelized; a bad inference on column 3 cannot poison column 7.
- **Refusal over guessing** — at confidence < 40 the model emits `__unmapped__`. At confidence delta < 10 between top-1 and top-2, the column is forced into the yellow review lane.
- **PII scrubbing** — sample values are pattern-preserving-scrubbed before any external call: `123-45-6789 → NNN-NN-NNNN`, `John Smith → NAME`, etc.
- **Calibrated confidence** — each proposal includes a self-reported score mapped to a color lane; the spec calls for an isotonic post-hoc calibration from labeled eval data.
- **Prompt pinning** — prompt + model + tool schema are versioned (`mapping-v1.0.0`); a change is a code review.
- **Audit trail** — every publish writes a mapping JSON with the full decision log.
- **No raw-value logging** — server sees shape-tokenized samples only; raw CSV rows never leave the browser.

## Eval

The `fixtures/` directory ships three sample sheets with gold mappings:

- `sheet_a.csv` — ACME Brokerage Census, 12 columns
- `sheet_b.csv` — HRIS Export Q1 2026, 14 columns
- `sheet_c.csv` — Carrier Claims Intake Report, 12 columns

Run `node scripts/regenerate-fixtures.mjs` (with `ANTHROPIC_API_KEY` set and the dev server running) to replay all three against live Claude. Current baseline: **26/26 top-1 on Sheets A and B** against the gold JSON. Full transcripts of the latest run live in `fixtures/sheet_*_transcript.json`.

## Project scripts

```bash
npm run dev        # start dev server
npm run build      # production build (typecheck + compile)
npm run start      # start production server
npm run lint       # eslint
```
