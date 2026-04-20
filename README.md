# AI Mapping Copilot

> Map messy insurance census spreadsheets to a canonical 12-field schema, with LLM-proposed mappings, calibrated confidence, human-in-the-loop review, and PII-safe sample handling.

This repo is my submission for the **AI Mapping Copilot** take-home. It contains three graded artifacts (Spec Packet, Option A eval set, AI Collaboration Log) **plus** a working Next.js MVP that demos the end-to-end flow.

---

## What's in this repo (map to the assignment)

| Assignment requirement | File |
|---|---|
| **Single submission packet (PDF)** — all three deliverables combined | [`SUBMISSION.pdf`](./SUBMISSION.pdf) · [`SUBMISSION.docx`](./SUBMISSION.docx) · [`SUBMISSION.md`](./SUBMISSION.md) |
| Spec Packet (7 sections + appendices) | [`SPEC_PACKET.md`](./SPEC_PACKET.md) |
| Hands-On Artifact — Option A: Mini Evaluation Set | [`EVAL_SET.md`](./EVAL_SET.md) + [`fixtures/`](./fixtures) |
| AI Collaboration Log (3 real prompts + critiques) | [`AI_COLLAB_LOG.md`](./AI_COLLAB_LOG.md) |
| Cherry — working MVP (optional) | [`app/`](./app), [`components/`](./components), [`lib/`](./lib) |

The MVP is additive: the spec and eval set stand on their own as the baseline deliverable. Reviewers who just want to read the submission can open `SUBMISSION.pdf` (35 pages). Reviewers who want to click through the product can use the deployed Vercel URL or `npm run dev` locally.

### Regenerating the submission packet

```bash
./scripts/build-submission.sh   # rebuilds SUBMISSION.md + .pdf + .docx from the three source MDs
```

---

## Run it locally (60 seconds)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then click **Try ACME Brokerage Census** or **Try HRIS Export Q1 2026**. The app will:

1. Load a sample CSV from `public/fixtures/`
2. POST the columns to `/api/propose`
3. Return pre-baked proposals (demo mode — no API key needed)
4. Render the three-lane review UI (green ≥95 / yellow 70–94 / red <70)
5. Let you edit mappings, click alternatives, ignore columns, and publish a canonical CSV

All values stay in the browser; the server sees pre-scrubbed shapes only.

---

## Run it live with Claude

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

With the env var set, `/api/propose` sends scrubbed samples to `claude-sonnet-4-6` using tool-use for structured output. Temperature 0, ephemeral prompt caching on the system block. Without the env var the route transparently falls back to demo fixtures.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel        # link project, accept defaults
vercel --prod # promote to production
```

In the Vercel dashboard: **Project → Settings → Environment Variables** → add `ANTHROPIC_API_KEY` for the Production scope. Redeploy. The route auto-detects the key and switches to live mode.

A single `vercel.json` isn't required; `next build` + `next start` works out of the box. Route handler has `export const maxDuration = 60` to cover the per-column fan-out under load.

---

## Architecture in one page

```
Browser
  │ CSV drop or demo click
  ▼
UploadDropzone / DemoLoader  ──►  papaparse  ──►  { headers, rows, columnSamples }
  │
  │ POST /api/propose { columns, mode? }
  ▼
app/api/propose/route.ts
  ├─ if no ANTHROPIC_API_KEY or mode==="demo":
  │    lib/demo-fixtures.ts loads public/fixtures/sheet_*_proposals.json
  │
  └─ else (live):
       Promise.all(columns.map(col => client.messages.create({
         model: "claude-sonnet-4-6",
         temperature: 0,
         system: [{ text: SYSTEM_PROMPT, cache_control: {type:"ephemeral"} }],
         tools: [TOOL_DEFINITION],         // closed-vocab enum
         tool_choice: { type: "tool", name: "propose_mapping" },
         messages: [{ role: "user", content: scrubbedSamples }]
       })))
  │
  │ { proposals, model, prompt_version, latency_ms, source }
  ▼
app/page.tsx
  ├─ ReviewPanel groups by confidence lane
  ├─ ColumnCard: header + samples + rationale + alternatives + edit + ignore
  └─ PublishBar gates on missing required fields + red-lane count
       │ publish
       ▼
  lib/canonical-csv.ts  ──►  canonical CSV + audit JSON downloads
```

Key files:

- [`lib/canonical.ts`](./lib/canonical.ts) — the 12 canonical fields, required set, and lane-classification helper
- [`lib/prompt.ts`](./lib/prompt.ts) — pinned system prompt (`mapping-v1.0.0`) + tool definition. Single source of truth for the LLM contract.
- [`lib/pii-scrub.ts`](./lib/pii-scrub.ts) — pattern-preserving scrubber (SSN, email, phone, name patterns → shape tokens)
- [`lib/canonical-csv.ts`](./lib/canonical-csv.ts) — emits the canonical CSV + audit JSON from the approved decisions
- [`lib/demo-fixtures.ts`](./lib/demo-fixtures.ts) — demo-mode loader (public/fixtures/sheet_*_proposals.json)
- [`app/api/propose/route.ts`](./app/api/propose/route.ts) — the route handler with per-column isolation + fallback
- [`components/*`](./components) — three-lane review UI

---

## Rubric map (where each graded dimension lives)

| Rubric dimension | Where to look |
|---|---|
| Product thinking & prioritization | `SPEC_PACKET.md` §1 Problem & Goals, §7 Rollout Plan |
| AI/LLM literacy + guardrails | `SPEC_PACKET.md` §4 + `lib/prompt.ts` + `app/api/propose/route.ts` (closed vocab, tool-use, per-column isolation, PII scrub, refusal path, prompt pinning) |
| Detail & testability | `SPEC_PACKET.md` §3 Requirements (F1–F12, NF1–NF10, C1–C10), §5 Evaluation Plan, `EVAL_SET.md` ambiguity tradeoffs |
| Hands-on execution | The MVP itself. `npm run dev` → live demo, `fixtures/*.csv` → 2 real inputs, `fixtures/*_gold.json` → gold truth |
| Communication clarity | This README, the three `.md` docs, in-app microcopy, concise rationales in proposals |

---

## Project scripts

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build (typecheck + compile)
npm run start    # start production server after build
npm run lint     # eslint
```

---

## Stack notes

- **Next.js 16.2** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Tailwind CSS 4** (CSS-based theming via `@theme`)
- **Anthropic SDK** with tool-use structured output + prompt caching
- **Papa Parse** for CSV parse / serialize
- **Zod** (installed, reserved for runtime validation at system boundaries in v2)
- **Lucide** for icons

No external state store; the entire session lives in a single React component. Persisting approved mappings across files (for the "re-intake loop" in the spec) is a v2 feature backed by a KV store.
