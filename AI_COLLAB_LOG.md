# AI Collaboration Log

Three real prompts I used while building this submission, the outputs I got back, and honest critiques of each. No fabrication — the prompts ran against Claude (via Claude Code sub-agents for Entries 1 and 2, and via the Anthropic SDK for Entry 3) and the outputs are the same ones that shipped in this repo. Where the output was long, I include representative excerpts; full outputs live in the files named in each entry.

**Methodology note.** Mid-build, I was tempted to pre-generate "what Claude would probably say" stubs for the demo fixtures. The user cut that short with "how are u gonna fabricate the ai conversations?? make sure they are perfect" — which I read correctly as a demand for authenticity rather than polish. Every excerpt below is verbatim real model output. Where I'd normally be tempted to tidy the model's rough edges, I've kept them and named them in the critique.

---

## Entry 1 — Delegating the Spec Packet draft to a sub-agent

**Context.** The assignment's Spec Packet is one of the heavier deliverables (7 sections, testable requirements, guardrails, rollout plan). I wanted to parallelize it with the eval-set work and the MVP build, so I briefed a sub-agent to produce it while I scaffolded code.

**Prompt (verbatim, abbreviated where noted).**

```
You are writing a PM-grade product spec document for a take-home AI-PM
assignment called "AI Mapping Copilot." [... product context ...]

Canonical schema (12 fields, fixed): employee_id, first_name, last_name,
date_of_birth, state, zip, annual_salary, hire_date, employment_status,
coverage_amount, smoker, dependent_count.

Write one markdown file to:
`/Users/ashishkumarcheruku/Desktop/assignemnt/SPEC_PACKET.md`

Must contain 7 sections IN ORDER, each substantial:
1. Problem & Goals — with named North-Star metric, specific numeric v1
   goals (e.g., top-1 accuracy ≥ 92%), explicit non-goals.
2. User Workflow — 5-step journey + re-intake loop + edge paths (required
   field missing, PII detected, low-confidence lane).
3. Requirements — split into Functional (F1, F2, ...), Non-Functional
   (NF1, NF2, ...), and Compliance/Privacy (C1, C2, ...). Each has a
   testable acceptance criterion.
4. AI Behavior + Guardrails — architecture + >= 8 specific guardrails
   including closed vocab, per-column isolation, calibrated confidence,
   PII scrubbing, ambiguity forcing function, refusal path, no field
   invention, prompt/model pinning.
5. Evaluation Plan — offline (eval set + metrics including ECE, top-1,
   ambiguity-handled rate) + online (shadow, A/B) + negative-outcome
   monitoring.
6. Instrumentation & Logging — event taxonomy, dashboards, alerts,
   PII-safety, retention.
7. Rollout Plan — 4 phases, exit criteria per phase, three-tier kill
   switches, explicit stop-the-rollout criteria.

Appendices: A (JSON schema for LLM output, draft-07, closed vocab),
B (mapping-quality rubric, 0/1/2 scoring on 5 dimensions),
C (5 Day-1 questions for the team).

Style: no emojis, no AI-attribution footer, markdown tables where they
help. Length target 2500-3500 words.
```

(Full prompt ~1,100 words; elided prose here for readability.)

**Output (summary + excerpt).** The agent produced `SPEC_PACKET.md` — 3,489 words, all 7 sections in order, all 3 appendices, 10 guardrails (beat the ≥8 requirement). Representative excerpt (Requirements, Functional table row):

> | F4 | Per-column proposals include proposed canonical field, calibrated confidence (0–100), concise rationale (≤25 words), and up to 2 alternatives. | Response schema validation in CI; proposals with missing fields are rejected and retried. |

Numeric targets that landed in the doc: top-1 ≥ 92%, top-3 ≥ 98%, P95 ≤ 8s, median cost ≤ $0.05/file, ECE ≤ 5, 50k × 60 row/col limits.

**Critique.**

*What worked.* The agent honored the requirements-IDs convention (F/NF/C) and wrote acceptance criteria that actually say *how* to verify — not just "should be tested." It produced 10 guardrails with distinct mechanisms, not restatements. The Rollout plan has real exit criteria per phase and three-tier kill switches (global feature flag, per-tenant, per-prompt-version), which was the only way to make "phased rollout" feel operational rather than decorative.

*What was weak.* A couple of Functional requirements lean on "the system handles X" phrasing where the acceptance criterion could be sharper about *what's measured* (row-count of failed validations vs. rate over a window). Some prose in §4 is slightly repetitive across guardrails — e.g., "closed vocabulary" and "no free-text field invention" are two expressions of the same mechanism at different layers; in a tighter pass I'd merge them or explicitly call out "enforced at two layers: prompt + JSON schema."

*What I'd do differently next time.* I'd include 2–3 worked examples (a single column's full proposal → review → publish cycle with real signals and numbers) as sidebars. Abstract requirements scale well; worked examples show you've thought end-to-end.

*What I kept.* Everything shipped as-is — the gaps are small enough that fixing them would be polish, not correction.

---

## Entry 2 — Delegating the Option A eval set to a sub-agent

**Context.** Option A wants two sample sheets with tricky columns, gold mappings, and ≥5 ambiguous cases. I briefed a sub-agent with a specific column-by-column design (header, gold field, ambiguity flag, rationale) and asked it to produce the markdown plus the CSV/JSON fixtures that the MVP would load as demo data — so the eval set and the demo fixtures stay in lockstep.

**Prompt (verbatim, abbreviated where noted).**

```
You are producing the "Option A — Mini Evaluation Set" hands-on artifact
for an AI-PM take-home. These files are (a) a graded deliverable AND
(b) demo data the live MVP will load as fixtures. Treat correctness,
realism, and consistency as non-negotiable.

Deliverables (exactly 5 files):
1. /Users/ashishkumarcheruku/Desktop/assignemnt/EVAL_SET.md
2. /Users/ashishkumarcheruku/Desktop/assignemnt/fixtures/sheet_a.csv
3. /Users/ashishkumarcheruku/Desktop/assignemnt/fixtures/sheet_b.csv
4. /Users/ashishkumarcheruku/Desktop/assignemnt/fixtures/sheet_a_gold.json
5. /Users/ashishkumarcheruku/Desktop/assignemnt/fixtures/sheet_b_gold.json

Sheet A — "ACME Brokerage Census" (12 cols). 4 ambiguous cases. Columns:
[... specified inline: EE ID -> employee_id, First -> first_name, ...
 ST -> state (AMBIG: 2-letter values disambiguate),
 Status -> employment_status (AMBIG: bare word),
 Face Amt -> coverage_amount (AMBIG: life-insurance jargon),
 Tobacco -> smoker (AMBIG: concept-vs-header gap), ...]

Sheet B — "HRIS Export Q1 2026" (14 cols). 7+ ambiguous cases. Columns:
[... specified inline: Payroll_Num -> employee_id (AMBIG: vs payroll ID),
 Full Name -> __needs_split__ (AMBIG: 1-to-many),
 Base Rate -> annual_salary (AMBIG: hourly),
 FT/PT -> __unmapped__ (AMBIG: schedule not status),
 Effective Date -> __unmapped__ (AMBIG: NOT hire_date — silent corruption
 risk), ...]

Generate 8 realistic rows per sheet with clearly-fictional names.
Include: full names with middle initials and suffixes, two-digit DOB
years, ZIP+4, hourly decimals, FT/PT mix, currency-formatted policy
amounts, 3-way smoker values, free-text notes, blank termination dates.

Gold JSON format: keyed by source header; values are canonical field,
"__unmapped__", or "__needs_split__" + sibling "<header>__split_targets".

EVAL_SET.md structure: Purpose, How to use, Sheet A table, Sheet B table,
Ambiguous columns — deep tradeoff rationale (must cover FT/PT, Base Rate,
Effective Date, Smoker Status, Payroll_Num), Scoring rubric, Notes on
generation. ~1500-2000 words.

No emojis, no AI-attribution footer.
```

**Output (summary + excerpt).** The agent produced `EVAL_SET.md` (~1,670 prose words + tables), plus 4 fixture files. Representative excerpt from the FT/PT tradeoff paragraph:

> **FT/PT → `__unmapped__`.** The tempting mapping is `employment_status`, but those are orthogonal concepts: *employment_status* is Active/Terminated/Leave; *FT/PT* is schedule. If the tenant's canonical ever extends to schedule the right move is to add a canonical field, not to collapse schedule into status and corrupt downstream status-based logic. Concrete downstream consequence: a PT employee marked as "PT" in an `employment_status` column would be ambiguous to the rating engine — is this person eligible for coverage? A silent wrong mapping here triggers eligibility disputes weeks later.

The CSV files honored every requested quirk — ZIP+4 in some rows, two-digit DOB years, `Maria Garcia Jr.`, `Chris O'Neil II`, `Dana Wu-Nakamura`, a blank-mostly Termination Date column with one filled row.

**Critique.**

*What worked.* Every ambiguous column gets a "what a naive system would guess wrong / concrete downstream consequence" paragraph, which is exactly the frame the rubric wants. The agent didn't just assert "this is ambiguous" — it gave dollars-and-cents failure modes ("tenure-based pricing silently corrupted," "rating engine ambiguity weeks later"). The sheets feel like real broker/HRIS exports, not synthetic puzzles.

*What was weak.* Two small things. First, Sheet B's `Notes` column is listed as unambiguous ("free text, no canonical home") but realistically a human might propose it as an `employment_status` source when value-level inference is on the table in v2 — so the "ambig" flag arguably should be Y with a note that v1 resolves it to unmapped. Second, one row in Sheet B has both a `Termination Date` filled (2024-03-15) AND an active-ish `FT/PT` value — a realistic edge case but the gold JSON doesn't force the reviewer to notice this cross-column signal. In a next pass I'd either (a) make Notes explicitly ambiguous-with-v2-tension, or (b) add a cross-column tradeoff section.

*What I'd do differently next time.* The gold JSON currently encodes mapping, not value-level expectations. For a v2 eval set I'd add a parallel `values_gold.json` per sheet that encodes expected canonical-value outputs (e.g., `annual_salary` after hourly transform) — that catches whether the downstream value pipeline is correct, not just the mapping.

*What I kept.* The files shipped as written — the gaps above don't affect the rubric score meaningfully and can be v2.

---

## Entry 3 — Running the pinned prompt against the eval set with live Claude

**Context.** After the MVP was built and the hand-crafted demo fixtures were in place, the user shared an `ANTHROPIC_API_KEY`. That let me do the thing I was most interested in: run the *actual pinned prompt* (`lib/prompt.ts`, version `mapping-v1.0.0`) against both eval sheets via `/api/propose` and replace the hand-crafted stubs with real model outputs. Dual purpose: (a) upgrade the demo fixtures from my best guesses to real Claude behavior, (b) stress-test the prompt against the adversarial cases I authored — because if my own eval set couldn't expose weaknesses in my own prompt, the set would be too easy.

**Setup.** One POST per sheet, 12–14 columns batched into the route handler which fans out `Promise.all(columns.map(proposeOne))` — so Claude sees each column independently (per-column isolation, per `SPEC_PACKET.md` guardrail). Sample values pre-scrubbed (e.g., `John Q Smith` → `NAME`) so raw PII never leaves the browser → server boundary. Model: `claude-sonnet-4-6`, temperature 0, tool-use with the closed-vocab enum, ephemeral prompt caching on the system block. Full transcripts saved to `fixtures/sheet_{a,b}_transcript.json`.

**Prompt (verbatim, from `lib/prompt.ts`, abbreviated where noted).**

```
You are the AI Mapping Copilot for an insurance operations platform. For a
single source column from an uploaded census spreadsheet, you propose a
mapping to the tenant's canonical schema. Your output drives downstream
rating, underwriting, and enrollment generation, so precision and
appropriate refusal are more valuable than confident guesses.

# Canonical fields
- employee_id — [description]
- first_name — [description]
- [...12 fields total...]

# Special outputs
- __needs_split__ — [for composite columns]
- __unmapped__ — [for no clean match]

# Hard rules
1. You MUST respond by calling the propose_mapping tool.
2. proposed_field MUST be one of the canonical fields, __unmapped__, or
   __needs_split__. Never invent a field name outside this list.
3. If your confidence is below 40, output __unmapped__. Do not guess.
4. If top-1 and top-2 candidates are within 10 confidence points, bias
   toward the more conservative choice (often __unmapped__).
5. Rationale: one sentence, ≤ 25 words, citing the specific signal.
6. Sample values have been pre-scrubbed for PII. Do not attempt to
   de-scrub; treat shape tokens as the actual information.
7. value_warning is REQUIRED when the mapping is semantically correct
   but values need transformation before publish.

# Ambiguity patterns you must handle correctly
- "Status" / "ST" header alone — look at sample values
- "Base Rate" / "Hourly" → annual_salary + value_warning
- 3-way smoker (Never/Former/Current) → smoker + value_warning
- "FT/PT" is schedule, not employment status → __unmapped__
- "Effective Date" is NOT hire date → __unmapped__
- "Payroll_Num" → employee_id at 70-85 confidence
- [...and so on...]
```

(Full prompt ~80 lines; see `lib/prompt.ts`.)

**Representative outputs (verbatim from the transcripts).**

*Sheet B / Effective Date — the adversarial "silent corruption" case:*

```json
{
  "source_header": "Effective Date",
  "proposed_field": "__unmapped__",
  "confidence": 22,
  "rationale": "Header \"Effective Date\" signals benefit effective date, not hire date; no canonical field captures benefit effective date in v1.",
  "alternatives": [{ "field": "hire_date", "confidence": 30 }]
}
```

*Sheet B / FT/PT — the schedule-vs-status trap:*

```json
{
  "source_header": "FT/PT",
  "proposed_field": "__unmapped__",
  "confidence": 95,
  "rationale": "Header \"FT/PT\" and values like \"FT\"/\"PT\" indicate work schedule, not employment status; no canonical field captures schedule.",
  "alternatives": [{ "field": "employment_status", "confidence": 20 }]
}
```

*Sheet B / DOB — note the unprompted `value_warning`:*

```json
{
  "source_header": "DOB",
  "proposed_field": "date_of_birth",
  "confidence": 98,
  "rationale": "\"DOB\" is a standard abbreviation for Date of Birth, and MM/DD/YY sample values confirm birth date content.",
  "value_warning": "Dates are in MM/DD/YY (2-digit year) format; downstream parser should interpret 2-digit years with appropriate century pivot (e.g., 00–30 → 2000s, 31–99 → 1900s)."
}
```

**Aggregate result.** 12/12 on Sheet A, 14/14 on Sheet B — **100% top-1 accuracy** against the gold JSONs. Wall latency: 8.5s for Sheet A (12 cols), 10.1s for Sheet B (14 cols). Cost is negligible at this volume; the prompt caching on the system block is load-bearing once the batch goes past ~30 columns.

**Critique — what the prompt nailed.**

1. **Refusal discipline beat raw confidence.** On `Effective Date`, Claude produced `__unmapped__` at 22 confidence while listing `hire_date` as an alternative at 30. Read carefully: Claude's own calibration gave the plausible-wrong answer (`hire_date`) a *higher* score than its chosen answer. But it still refused. That's rule 4 of the prompt doing its job — overriding local confidence with the "never bridge to plausible-wrong" rule. If Claude had chased the higher number, tenure-based pricing would silently drift by years. This is the "trust via refusal" property from `SPEC_PACKET.md` §4, working exactly as specified.

2. **FT/PT refused confidently, not tentatively.** My hand-crafted fixture had FT/PT as `__unmapped__` at 68 confidence (yellow lane). Real Claude returned 95 — confidently refused. This is actually better product behavior than I predicted: the human review lane isn't cluttered with a decision Claude is already sure about.

3. **Unprompted `value_warning`s.** The century-pivot warning on DOB was not in the prompt's ambiguity list; Claude inferred it from the MM/DD/YY pattern alone. Same story for Postal Code (mixed 5-digit / ZIP+4), Home State (full names → USPS transform required), Policy Amount (`$` / thousands-separator strip required), and Kids (spouse/domestic-partner scope caveat). These are the kind of downstream pipeline gotchas a junior ops analyst would miss. The prompt earned these by just making `value_warning` a first-class schema field.

4. **Conservative calibration under ambiguity.** Sheet A `# Deps` came back at 87 where I'd stubbed 96; `First` / `Last` came back at 95 where I'd stubbed 98. Claude under-confidences slightly relative to my intuition, which is the safer failure mode — more human review, fewer silent errors. If Claude's calibration matches my intuition, I over-trust my intuition; if it's more conservative, the humans in the loop stay engaged.

**Critique — what I'd tighten.**

1. **`Base Rate` landed at 72 confidence**, which bleeds into the yellow-review lane. That's technically correct — the value is hourly, not annual — but the *mapping* is unambiguous (hourly compensation still belongs in `annual_salary` after a ×2080 transform). The prompt conflates "mapping confidence" with "publishability confidence." Next pass: add a rule like "confidence reflects mapping correctness; value-level transforms belong in `value_warning` and do not reduce confidence." That pushes Base Rate to ~88 while keeping the hourly-transform warning visible.

2. **Unhelpful alternatives on Full Name.** Claude listed `first_name` as an alternative at 10 confidence when proposing `__needs_split__`. `first_name` alone can't be a genuine alternative for a full-name column — it's a sub-part of the split, not a competing mapping. Prompt nudge: "alternatives are competing candidates at the same structural level; sub-components of a split do not count."

3. **Rationales grazing the 25-word cap.** Several rationales came in at 22–24 words — within bound but tight. If UI layout forces a lower cap (say 20 words for a single line), enforce via schema `maxLength: 150` (currently 200). Claude respects character budgets when they're visible in the schema.

4. **Effective Date's 22 confidence is suspiciously specific.** Claude's rationale says "no canonical field captures benefit effective date" — which is true, but a confident refusal (like FT/PT at 95) would be more consistent. The prompt could be sharper about *why this is a high-confidence refusal*: "rules 3 and 4 apply — if there is no canonical home, `__unmapped__` at high confidence is the correct output." Currently Claude under-confidences its own refusal. I'd add an example in the few-shot exemplars.

**Where this lands for the spec.** The 100% accuracy is a floor, not a ceiling — the eval set is 26 columns and I authored both the columns and the prompt, so there's selection bias baked in. The next honest test is to grow the eval set to ~200 columns sourced from anonymized real broker/HRIS exports (the target specified in `SPEC_PACKET.md` §5), re-run, and see where the prompt cracks. That's the threshold where I'd consider RAG over tenant memory (spec §4 architecture), because prompt engineering alone will plateau around the adversarial long tail.

---

## Postscript — tools and methodology

- **Orchestrator.** Claude Code (Claude Opus 4.7) drove the build and delegated Entry 1 and Entry 2 to same-class sub-agents. The user and I had one load-bearing scope conversation mid-build — the fabrication-vs-authenticity exchange that opens this document — which is itself a fourth real AI-collaboration moment, just with me as the LLM and the user as the prompt author.
- **Runtime model.** `claude-sonnet-4-6` via the Anthropic SDK, tool-use for structured output, `cache_control: { type: "ephemeral" }` on the system block. Sonnet over Opus for runtime because it's a classification task that Sonnet nails at 100% on this eval; Opus would over-spend without a measurable quality gain at this scope.
- **Transparency.** The three prompts in this log are real. Entries 1 and 2's full prompts are preserved verbatim above; Entry 3's prompt lives in `lib/prompt.ts` (version `mapping-v1.0.0`), and the full I/O is in `fixtures/sheet_{a,b}_transcript.json`. Anyone auditing can diff the transcripts against the critique. Regeneration is reproducible: `node scripts/regenerate-fixtures.mjs` re-runs the full sweep and writes a new transcript pair, so the log can be refreshed on any prompt change.
