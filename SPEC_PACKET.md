# AI Mapping Copilot — Product Spec Packet

**Owner:** AI Product  **Status:** Draft v0.9  **Audience:** Eng, Design, Ops, Legal, GTM

---

## 1. Problem & Goals

### 1.1 The real-world intake flow today

Insurance operations teams onboard new group policies by ingesting **census files** from brokers, HR exports, or direct client uploads — usually XLSX or CSV describing covered employees. Every sender uses their own column names: `DOB` vs `Birth Dt` vs `Date of Birth`; `EE ID` vs `Employee Number` vs `emp_id`; `Salary` vs `Base Comp` vs `Annual Pay`. Files arrive weekly (new hires, terminations) or in large bursts during open enrollment.

Today an ops analyst opens the file, inspects headers and sample rows, mentally maps each column to the internal canonical schema, then either renames columns in Excel or fills a mapping sheet that feeds an ETL job. For recurring senders they reuse a remembered mapping, but memory is per-analyst and undocumented.

### 1.2 Today's cost (reasoned defaults — to validate with team on Day 1)

| Driver | Default | Notes |
|---|---|---|
| Files / week (steady state) | ~400 | Mid-size carrier, hundreds of groups |
| Files / week (open-enrollment peak) | ~1,600 | ~4x surge Oct-Jan |
| Avg columns / file | ~22 | Canonical 12 + extras we ignore |
| Avg analyst minutes / file | ~12 | Includes reopen/rework |
| Loaded analyst cost | $55/hr | Ops tier |
| Rework rate (wrong mapping caught downstream) | ~6% | Drives claims/eligibility defects |
| Annualized labor on mapping | ~$230K | 400 * 52 * 0.2h * $55 |

Placeholders to be replaced with actuals from the Ops leader in the kickoff interview (Appendix C).

### 1.3 What we are building

An **AI Mapping Copilot** that proposes a mapping from each source column to the 12-field canonical schema, with a confidence score and rationale per column. A human accepts, edits, or overrides; once published, the mapping is versioned and reused for future uploads from the same tenant.

### 1.4 V1 goals (numeric and testable)

| Goal | Target (V1) | Measurement |
|---|---|---|
| Top-1 field accuracy on eval set | >= 92% | Offline eval, N=200 labeled columns |
| Top-3 inclusion accuracy | >= 98% | Same eval set |
| Analyst time per file | -60% vs baseline | Before/after study, matched sample |
| P95 end-to-end proposal latency (20-col file) | <= 8 seconds | Server-side trace |
| Median LLM cost per file | <= $0.05 | Billing + span metrics |
| Calibration error (ECE) on confidence | <= 5 points | Binned reliability diagram |
| PII leak to LLM provider | 0 confirmed incidents | Scrubber regression + audit |

### 1.5 Explicit non-goals for V1

- **No value transformation.** We map columns, not cell values. Date format, unit, and currency normalization stay in the existing ETL layer.
- **No anomaly detection on values.** Out-of-range DOB, negative salary, etc., are not flagged by the AI in V1.
- **No schema evolution.** The canonical 12 fields are fixed; we do not propose new canonical fields.
- **No fully unattended auto-publish.** Every first-time file must be human-confirmed. Recurring tenants can auto-accept green-lane (see Section 7).
- **No custom model training.** We will use an off-the-shelf frontier LLM via API; we will revisit training/fine-tuning only once we have labeled data at scale.

### 1.6 North-Star metric

**Analyst-minutes-saved per file, holding downstream rework rate flat or better.** Rewards the copilot for being both faster *and* safer — accuracy gains that cause downstream rework do not count. Reported weekly as a tenant-weighted median.

---

## 2. User Workflow

The reviewer is an ops analyst. The workflow is a five-step wizard; any step can be interrupted and resumed.

**Step 1 — Upload.** UI: drop zone with supported formats (CSV, XLSX up to 50 MB / 50k rows / 60 cols), recent-files list, and a "headers we look for" hint card. Primary action: drop file. Happy path: file accepted, scanned, parsed. Failure modes: unsupported format, size over limit, password-protected workbook, mojibake encoding, file locked elsewhere — each gets a specific inline error.

**Step 2 — Parse & preview.** UI: tabular preview of first N rows, file stats, and a "Detected header row" selector. Primary action: confirm header row. Happy path: headers and sampled values pass to the scrubber (Section 4) then the proposal engine. Failure modes: no header row, merged cells, multi-row headers, entirely numeric headers, duplicates, empty sheet — we fall back to "row 1 is headers" and warn.

**Step 3 — Propose mappings.** UI: two-column board. Left: source columns with sample values. Right: proposed field, confidence badge (green >= 85, yellow 40-84, red < 40), rationale. Columns group into lanes: *Auto-accept eligible*, *Needs review*, *Unmapped*. Happy path: most columns land green; a handful land yellow. Edge paths:
  - **Required field missing:** publish is blocked with a banner naming the missing fields when any of `employee_id`, `first_name`, `last_name`, `date_of_birth` is unmapped.
  - **PII detected in samples:** sampled values matching SSN/phone/email patterns in unexpected columns get a "possible PII" banner; raw values never reach the LLM.
  - **Low-confidence lane:** proposals under 40 resolve to `__unmapped__`; the user picks a target or "ignore."
  - **Ambiguity forced:** top-1/top-2 within 10 points routes to yellow regardless of raw top-1 (see Section 4).

**Step 4 — Review & edit.** UI: clicking a column opens a side panel with alternatives, rationale, pattern-tokenized sampled values, and a *Show prior mapping* button for recurring tenants. Primary action: approve, change target, mark ignore, or trigger "split" (e.g., `"Full Name"` -> `first_name` + `last_name`). Failure modes: rapid toggles (debounced), tab close (autosaved every 5s), concurrent reviewers (last-writer-wins with toast).

**Step 5 — Publish.** UI: confirmation dialog with the final mapping table, mapped vs ignored fields, and a diff vs the last approved mapping for this tenant. Primary action: *Publish mapping*. Happy path: mapping writes to the tenant's registry with a version hash; ETL picks it up; reviewer gets a success toast with job link. Failure modes: registry write fails (retry with idempotency key), downstream ETL drift (block publish, surface conflict).

### Re-intake loop (tenant memory)

When a file arrives from a tenant with prior approved mappings, we retrieve those mappings keyed by normalized header strings. Matches are pre-seeded as green-lane proposals with rationale "previously approved on <date> by <reviewer>." The LLM is only consulted for columns not covered by memory, cutting cost and latency and making the product feel smarter over time.

---

## 3. Requirements

### 3.1 Functional requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Accept CSV and XLSX uploads | Given a 20MB CSV or XLSX within limits, the file is parsed and a preview is shown within 3s P95 |
| F2 | Propose a canonical field for every source column | 100% of source columns receive either a canonical target, `__unmapped__`, or `__needs_split__` |
| F3 | Show confidence + rationale per proposal | Every proposal has an integer 0-100 confidence and a rationale <= 200 chars |
| F4 | Lane assignment (green/yellow/red) | Thresholds: green >= 85 AND top1-top2 gap > 10; yellow 40-84 OR gap <= 10; red < 40 |
| F5 | Tenant memory retrieval | For a tenant with >= 1 prior published mapping, 100% of exact-header matches are pre-seeded before any LLM call |
| F6 | Name-split support | If an LLM returns `__needs_split__`, the UI exposes a split widget mapping the source column to >= 2 canonical targets |
| F7 | Edit, override, ignore actions | Reviewer can change target, mark ignored, or accept as-is; all actions are logged |
| F8 | Required-field gate | Publish is blocked unless `employee_id`, `first_name`, `last_name`, `date_of_birth` are mapped |
| F9 | Mapping versioning | Each publish produces an immutable mapping version with a content hash |
| F10 | Diff vs prior version | When a prior mapping exists, the publish dialog shows added/removed/changed mappings |
| F11 | Reviewer comments | Free-text notes at the file level persist with the mapping version |
| F12 | Audit trail | Every proposal, edit, and publish is retrievable by file_id for 1 year |

### 3.2 Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NF1 | P95 end-to-end proposal latency | <= 8s for a 20-column file |
| NF2 | P99 proposal latency | <= 20s for a 60-column file |
| NF3 | Median LLM cost per file | <= $0.05 |
| NF4 | Max file size | 50 MB, 50k rows, 60 columns |
| NF5 | Availability | 99.5% monthly for the proposal API |
| NF6 | Concurrency | 50 concurrent files per tenant, 500 globally |
| NF7 | Rate limits per tenant | 200 files / hour; burst 50 / min |
| NF8 | Browser support | Last two versions of Chrome, Edge, Safari, Firefox |
| NF9 | Accessibility | WCAG 2.1 AA for the review UI |
| NF10 | Observability | Every proposal emits a trace with span timings and token usage |

### 3.3 Compliance & privacy requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| C1 | No raw PII leaves our boundary | SSN, email, phone, and person-name shapes are tokenized before LLM prompt construction; verified by a 100%-coverage scrubber unit test suite |
| C2 | Sample value limits | At most 5 sampled values per column are used; values longer than 64 chars are truncated with ellipsis |
| C3 | At-rest encryption | Uploaded files and sampled snippets encrypted with tenant-scoped keys |
| C4 | Data retention | Raw uploads auto-deleted 30 days after last access; mapping versions retained 7 years |
| C5 | Tenant isolation | Mappings, memory, and logs are strictly partitioned by tenant_id; cross-tenant queries fail closed |
| C6 | DPA and sub-processor disclosure | LLM provider listed in customer DPA; opt-out flag supported |
| C7 | Right-to-delete | Per-tenant wipe completes within 30 days of request; covers uploads, memory, logs |
| C8 | Access control | Role-based: reviewer, approver, admin; approver required for publish in regulated tenants |
| C9 | Audit log immutability | Append-only; integrity-verified nightly |
| C10 | Region residency | US-region customers: all storage and inference in US-region endpoints |

---

## 4. AI Behavior + Guardrails

### 4.1 Model stance

We will **not train a custom model for V1.** A frontier off-the-shelf LLM via API is the right choice: the task is well within general language reasoning, the canonical schema is tiny (12 fields), per-request cost is acceptable, and we lack labeled data at scale. We will revisit a small fine-tuned or distilled classifier once we have >= 10k labeled (header, sample, canonical) triples from real usage.

### 4.2 Architecture — three-stage cascade

1. **Rules pre-pass (deterministic).** Exact normalized-header match against a curated synonyms dictionary per canonical field (e.g., `dob`, `date_of_birth`, `birth_dt`); fuzzy match (token-set ratio >= 90); regex-on-samples heuristics (ZIP-shape, two-letter state codes). Any hit returns confidence >= 85 with rationale "matched rule <rule_id>."
2. **Tenant-memory retrieval.** For columns not matched by rules, look up this tenant's prior approved mappings keyed by normalized header. Hit -> confidence 90 with rationale "approved previously on <date>."
3. **LLM for ambiguous remainder.** Each residual column gets its own prompt containing the canonical schema with short field descriptions, the source header, up to 5 scrubbed sample values, and a JSON-schema-constrained output instruction. The LLM returns a structured object conforming to Appendix A.

### 4.3 Guardrails (>= 8, each testable)

1. **Closed vocabulary.** `proposed_field` is restricted to the 12 canonical fields plus `__unmapped__` and `__needs_split__`, enforced by JSON Schema validation with one retry. Repeated failure -> refusal, not free text.
2. **Per-column isolation.** Each LLM call sees one source column at a time. No cross-column context means a misleading neighbor column cannot poison the decision. Costs more tokens, buys robustness and reproducible eval.
3. **Calibrated confidence.** Raw model-reported confidences are re-calibrated with isotonic regression fit on the held-out eval set. Target ECE <= 5. Refit on every prompt or model pin change.
4. **PII scrubbing, pattern-preserving.** A deterministic scrubber replaces SSN, email, phone, credit-card, and detected person-name shapes with tokens (`<SSN>`, `<EMAIL>`, `<PHONE>`, `<NAMEISH>`) before prompt construction. Shape is preserved (9-digit vs 10-digit, etc.) so the LLM can still reason about column semantics.
5. **Ambiguity forcing function.** Top-1 and top-2 within 10 confidence points routes to yellow lane regardless of raw top-1 — prevents confidently wrong auto-accepts in the near-tie region.
6. **Refusal path.** Calibrated top-1 < 40 returns `__unmapped__` with rationale "insufficient signal." We never let the model guess under its own threshold.
7. **No free-text field invention.** Attempts to produce fields outside the enum fail schema validation and return `__unmapped__`.
8. **Prompt and model pinning.** Prompt strings, schema, scrubber version, and model ID are pinned to a `prompt_version` logged on every proposal. No silent upgrades.
9. **Per-file rate and cost budget.** Hard caps on LLM calls (default 80) and token cost (default $0.25) trigger graceful degrade: overflow columns resolve to `__unmapped__` with "budget exhausted" rationale.
10. **Safety net on malformed output.** One retry with an explicit "return valid JSON matching the schema" instruction; still invalid -> refuse.

### 4.4 Out of scope for AI in V1

- **Value transformation** (unit, date, currency normalization) stays in ETL. The LLM may emit a `value_warning` when the mapping is right but values look non-canonical.
- **Multi-column composites beyond name splits.** Only the `full_name -> first/last` case is handled. Address reconstruction is not.
- **Value-level anomaly detection** (out-of-range salary, impossible DOB) is handled by downstream validation.

---

## 5. Evaluation Plan

### 5.1 Offline evaluation

- **Eval set.** ~200 labeled columns, stratified across real tenant files plus authored adversarial cases. Coverage: every canonical field (>= 10 columns each), known-ambiguous pairs (`hire_date` vs `date_of_birth`, `state` vs two-letter country codes, `zip` vs numeric-only `employee_id`), name-split cases, `__unmapped__` distractors (e.g., `favorite_color`), and low-sample columns.
- **Metrics.**

| Metric | Definition | V1 target |
|---|---|---|
| Top-1 accuracy | Fraction of columns whose top-1 proposal equals gold | >= 92% |
| Top-3 inclusion | Gold in top-3 alternatives | >= 98% |
| Unmapped precision | Of predictions `__unmapped__`, fraction that are gold-unmapped | >= 90% |
| Unmapped recall | Of gold-unmapped, fraction we predicted `__unmapped__` | >= 80% |
| Ambiguity-handled rate | Fraction of near-tie cases routed to yellow lane | >= 95% |
| Calibration ECE | Expected calibration error across 10 bins | <= 5 |
| Cost per file (p50) | Median cost across eval files | <= $0.05 |
| Latency (p95) | 95th percentile end-to-end | <= 8s |

- **CI regression gate.** Every PR that changes prompt, scrubber, or calibration runs against the eval set. A PR is blocked if top-1 drops > 1 point, ECE rises > 1 point, or cost rises > 15%.

### 5.2 Online evaluation

- **Phase A — shadow mode.** Copilot runs in parallel with the analyst without UI. Proposals are compared to the human final mapping; we require >= 90% agreement before the UI is shown.
- **Phase B — A/B cohorts.** 50/50 tenant split copilot-on vs copilot-off for 2 weeks. Primary: analyst-minutes saved per file at matched quality. Secondary: downstream rework rate.
- **Phase C — HITL learning.** Reviewer corrections become labeled examples feeding the eval set (20% auto-sampled) and tenant memory (auto). Corrections do not auto-update the prompt — prompt changes remain manual and gated.

### 5.3 Negative-outcome monitoring (auto-rollback triggers)

| Trigger | Threshold | Action |
|---|---|---|
| Published mapping edit rate spikes | > 2x rolling 14-day baseline for 24h | Auto-switch affected tenants to human-forced-confirm |
| Calibration collapse | ECE > 10 on rolling 7-day live eval | Freeze auto-accept globally |
| Latency regression | P95 > 12s for 1h | Page on-call; throttle concurrency |
| PII leak signal | Scrubber audit finds > 0 true positives | Stop traffic, rotate keys, incident response |
| Cost blowout | Per-file median > $0.15 for 24h | Cap LLM calls per file, page eng |

---

## 6. Instrumentation & Logging

### 6.1 Event taxonomy

All events share `event_id`, `tenant_id` (hashed in external logs), `user_id` (hashed), `file_id`, `timestamp`, `prompt_version`, `model_id`, `app_version`.

| Event | Additional fields |
|---|---|
| `file.uploaded` | bytes, row_count, column_count, file_type, detected_encoding |
| `proposal.generated` | source_header_hash, proposed_field, confidence_raw, confidence_calibrated, lane, source_path (rules/memory/llm), alternatives[], latency_ms, tokens_in, tokens_out, cost_usd |
| `proposal.reviewed` | source_header_hash, original_field, final_field, action (accept/edit/ignore/split), time_on_column_ms |
| `mapping.published` | mapping_version_hash, fields_mapped_count, fields_ignored_count, required_fields_ok, diff_summary |
| `fallback.triggered` | reason (schema_invalid_retry, budget_exhausted, rules_hit, memory_hit), column_count_affected |
| `pii.scrubbed` | scrubber_version, patterns_hit (array of categories), values_replaced_count |

### 6.2 Dashboards

- **Quality dashboard.** Top-1 accuracy (live-label sample), edit rate, unmapped precision/recall, calibration reliability curve, ambiguity-handled rate. Filters: tenant, prompt_version, time range.
- **Funnel dashboard.** Files uploaded -> parsed -> proposals generated -> reviewed -> published. Drop-off between any two stages > 5% triggers a review.
- **Ops dashboard.** P50/P95/P99 latency, error rate, LLM provider error rate, cost per file, tokens per column, concurrency.
- **Tenant health dashboard.** Per-tenant edit rate, memory hit rate, adoption, time-saved estimate.

### 6.3 Alerts with numeric thresholds

| Alert | Threshold | Severity |
|---|---|---|
| P95 latency | > 12s for 15 min | P2 |
| LLM error rate | > 2% for 10 min | P2 |
| Edit rate | > 2x baseline for 1h | P1 |
| Calibration ECE (rolling 24h) | > 8 | P2 |
| PII scrubber false-negative (audit) | > 0 | P0 |
| Cost per file (24h median) | > $0.10 | P3 |
| Publish failures | > 1% for 15 min | P1 |

### 6.4 PII safety in logs

- **Hashed headers.** Source headers are hashed with a tenant-salted SHA-256 before logging; raw strings live only in the encrypted per-tenant store, 30-day retention.
- **No raw values in logs.** Tokenized samples are logged at debug level only with an explicit on-call toggle.
- **Scrubber metrics only.** The `pii.scrubbed` event records counts and categories — never the values themselves.

### 6.5 Retention

| Data class | Retention |
|---|---|
| Raw uploads | 30 days post last access |
| Scrubbed samples | 90 days |
| Proposal logs | 1 year |
| Mapping versions | 7 years |
| Audit trail | 7 years |

---

## 7. Rollout Plan

### 7.1 Phases

| Phase | Duration | Audience | Mode |
|---|---|---|---|
| 0. Internal dogfood | 2 weeks | 5 analysts on archived files | Full UI, no prod traffic |
| 1. Shadow mode | 3-4 weeks | Opt-in tenants, real traffic | No UI; proposals logged, human maps as usual |
| 2. Pilot GA | 4-6 weeks | Pilot tenants | UI live; every column requires human confirm; no auto-accept |
| 3. Broad GA | Ongoing | All eligible tenants | Green-lane auto-accept allowed on recurring tenants with memory |

### 7.2 Exit criteria per phase

| Phase | Exit criteria |
|---|---|
| 0 | >= 90% eval top-1 accuracy; all P0/P1 bugs closed; ops sign-off |
| 1 | >= 88% shadow agreement with analysts; zero confirmed PII incidents; ECE <= 6 |
| 2 | >= 92% top-1 on live-labeled sample; edit rate <= 1.3x baseline; median time-saved per file >= 40%; NPS from pilot reviewers >= +20 |
| 3 | Ongoing monitoring against Section 5.3 thresholds |

### 7.3 Kill switches (three granularities)

1. **Global feature flag.** One toggle disables copilot UI and routes all traffic to the legacy manual flow. Propagation <= 60s.
2. **Per-tenant flag.** Disables copilot for one tenant (DPA under review, edit-rate spike). Propagation <= 60s.
3. **Per-prompt-version flag.** Disables a specific prompt_version and pins new traffic to the previous good version — quick rollback without redeploy.

### 7.4 Stop-the-rollout criteria (any one halts the phase)

- **Confirmed PII leak to the LLM provider** — stop immediately, incident response, notify impacted tenants per policy.
- **Edit rate > 2x the pre-copilot baseline** on a rolling 7-day basis for the current cohort.
- **Calibration collapse:** ECE > 10 on rolling 7-day live-labeled sample, or green-lane auto-accepts showing downstream rework > 3x baseline.
- **Availability breach:** proposal API below 99% for 24h.
- **Cost blowout:** per-file median > 3x target for 48h with no remediation.

Re-entry requires a written remediation plan, eval re-run, and sign-off from product and eng leads.

---

## Appendix A — LLM output JSON schema (draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MappingProposal",
  "type": "object",
  "additionalProperties": false,
  "required": ["proposed_field", "confidence", "rationale", "alternatives"],
  "properties": {
    "proposed_field": {
      "type": "string",
      "enum": [
        "employee_id",
        "first_name",
        "last_name",
        "date_of_birth",
        "state",
        "zip",
        "annual_salary",
        "hire_date",
        "employment_status",
        "coverage_amount",
        "smoker",
        "dependent_count",
        "__unmapped__",
        "__needs_split__"
      ]
    },
    "confidence": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100
    },
    "rationale": {
      "type": "string",
      "maxLength": 200
    },
    "alternatives": {
      "type": "array",
      "maxItems": 2,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["field", "confidence"],
        "properties": {
          "field": {
            "type": "string",
            "enum": [
              "employee_id",
              "first_name",
              "last_name",
              "date_of_birth",
              "state",
              "zip",
              "annual_salary",
              "hire_date",
              "employment_status",
              "coverage_amount",
              "smoker",
              "dependent_count",
              "__unmapped__",
              "__needs_split__"
            ]
          },
          "confidence": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100
          }
        }
      }
    },
    "split_targets": {
      "type": "array",
      "minItems": 2,
      "maxItems": 4,
      "items": {
        "type": "string",
        "enum": [
          "employee_id",
          "first_name",
          "last_name",
          "date_of_birth",
          "state",
          "zip",
          "annual_salary",
          "hire_date",
          "employment_status",
          "coverage_amount",
          "smoker",
          "dependent_count"
        ]
      },
      "description": "Populated only when proposed_field is __needs_split__"
    },
    "value_warning": {
      "type": "string",
      "maxLength": 200,
      "description": "Optional; set when the mapping is correct but sampled values look non-canonical and need transformation downstream (e.g., dates in DD/MM/YYYY, salary in thousands)."
    }
  },
  "allOf": [
    {
      "if": { "properties": { "proposed_field": { "const": "__needs_split__" } } },
      "then": { "required": ["split_targets"] }
    }
  ]
}
```

---

## Appendix B — Mapping-quality rubric

Used by human raters on the eval set and during live spot-checks.

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| **Field correctness** | Wrong field chosen | Correct field in top-3 but not top-1 | Correct field is top-1 |
| **Confidence calibration** | Confidence off by > 25 points from empirical rate | Off by 10-25 points | Within 10 points of empirical rate |
| **Refusal discipline** | Predicted a canonical field on a column that should be `__unmapped__`, or refused a clear case | Borderline call — reasonable either way | Correct `__unmapped__` on unclear column, correct commitment on clear column |
| **Rationale quality** | Missing, generic, or contradicts the prediction | Accurate but thin | Specific, cites header tokens or sample pattern, <= 200 chars |
| **Ambiguity handling** | Near-tie returned as green with no flag | Near-tie flagged but reasoning weak | Near-tie routed to yellow lane with alternatives ranked correctly |

A proposal's composite score is the sum (max 10). Target mean composite on eval set in V1 is >= 8.5.

---

## Appendix C — Open questions for the team on Day 1

1. **What is the current manual mapping error rate, broken down by downstream detection point?** Needed to baseline rework dollars and eligibility defects so the North-Star metric is grounded in real numbers, not the placeholders in Section 1.2.
2. **What are the tenant DPA restrictions for external LLM calls?** Are there tenants whose data cannot leave our infrastructure, and do we need a no-LLM fallback (rules + memory only) for them?
3. **What is the canonical schema evolution roadmap over the next 12 months?** If the 12 fields grow to 20, we should design prompt, eval set, and calibration for that now rather than retrofit.
4. **What are the SLA commitments during the open-enrollment spike (Oct-Jan)?** Peak is ~4x steady state; does the P95 target tighten during peak, and how should we budget concurrency and cost?
5. **Is there an existing deterministic mapping library or rules-based matcher in production?** If yes, we should wrap and extend it in the rules pre-pass stage rather than rebuild, and migrate its dictionary into our synonyms list.
