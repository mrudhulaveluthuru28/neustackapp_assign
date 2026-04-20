# AI Mapping Copilot — Mini Evaluation Set (Option A)

## 1. Purpose

This evaluation set is the ground-truth fixture for grading the AI Mapping Copilot, a tool that proposes mappings from messy source spreadsheet headers to a fixed 12-field canonical insurance schema. It serves three audiences at once. First, it is a **graded deliverable** for the AI-PM take-home: two source sheets plus hand-labeled gold mappings, calibrated so a system that naively string-matches loses points while a system that understands domain context and flags uncertainty earns them. Second, it is the **demo fixture** the live MVP loads at startup so reviewers can run the copilot end-to-end without uploading anything. Third, it is the **design seed** for the 200-column offline eval set that will grade future versions; the column archetypes, ambiguity patterns, and rubric shape are meant to scale.

The canonical schema under test is exactly 12 fields: `employee_id`, `first_name`, `last_name`, `date_of_birth`, `state`, `zip`, `annual_salary`, `hire_date`, `employment_status`, `coverage_amount`, `smoker`, `dependent_count`. Any source column that does not cleanly land in one of those 12 must map to `__unmapped__`. A full-name column that encodes two canonical fields maps to `__needs_split__` with an auxiliary `<header>__split_targets` list.

## 2. How to use

The intended loop: the system reads one of the CSVs, inspects header strings and a sample of values per column, and emits a **mapping proposal** — an object keyed by source header whose value is one of the 12 canonical fields, `__unmapped__`, or `__needs_split__` plus split targets. The proposal should carry per-column confidence and a short rationale. The system is not expected to transform values; value-level issues (ZIP+4 normalization, hourly-to-annual scaling, tri-state smoker collapse, two-digit year expansion) are out of scope for v1 and belong to a downstream transform step. The copilot may, however, **flag** these issues alongside its proposal.

Proposals are scored against the gold JSON in `fixtures/sheet_a_gold.json` and `fixtures/sheet_b_gold.json` using four metrics: top-1 accuracy, ambiguity-handled rate, unmapped precision/recall, and refusal discipline. Top-1 accuracy is the blunt "did it pick the right label" number. The other three exist because the interesting failure modes are not wrong labels on easy columns — they are confident-wrong labels on ambiguous columns and over-eager mappings of junk. A system optimized only for top-1 accuracy will silently corrupt tenure calculations and underwriting data; the rubric rewards systems that know when to say "I'm not sure."

## 3. Sheet A — ACME Brokerage Census

Broker-produced census file, 12 columns, relatively clean headers using common insurance shorthand. Four columns are genuinely ambiguous and test whether the system leverages **sample values** in addition to header strings.

| #  | Source Header | Sample Values                | Gold Canonical Field | Ambig? | Notes / Why tricky                                                                                                  |
|----|---------------|------------------------------|----------------------|--------|---------------------------------------------------------------------------------------------------------------------|
| 1  | `EE ID`       | 10234, 10245, 10258          | `employee_id`        | No     | "EE" is standard insurance shorthand for employee; common broker convention.                                        |
| 2  | `First`       | Avery, Jordan, Taylor        | `first_name`         | No     | Clean shorthand for first name.                                                                                     |
| 3  | `Last`        | Chen, Patel, Kim             | `last_name`          | No     | Clean shorthand for last name.                                                                                      |
| 4  | `Birth Dt`    | 1988-04-12, 1975-11-23       | `date_of_birth`      | No     | "Dt" is common date-column shorthand; unambiguous with "Birth".                                                     |
| 5  | `ST`          | CA, NY, WA, IL               | `state`              | Yes    | Bare "ST" is lexically closer to "Status" than "State"; USPS 2-letter sample values are the disambiguator.          |
| 6  | `Zip`         | 94107, 10025, 02139          | `zip`                | No     | Header is canonical. Leading-zero concern is a value-level issue, not a mapping issue.                              |
| 7  | `Annual Comp` | 92000, 148500, 67400         | `annual_salary`      | No     | "Annual" explicitly disambiguates compensation cadence; safe direct mapping.                                        |
| 8  | `Hire`        | 2019-03-04, 2012-07-15       | `hire_date`          | No     | Shorthand but unambiguous in an HR census context.                                                                  |
| 9  | `Status`      | Active, Termed, Leave        | `employment_status`  | Yes    | Bare word "Status" could mean anything (marital, enrollment, policy). Sample values are the disambiguator.          |
| 10 | `Face Amt`    | 250000, 500000, 150000       | `coverage_amount`    | Yes    | Life-insurance jargon: "face amount" is the policy payout. A non-domain model may map to `annual_salary` or unmap.  |
| 11 | `Tobacco`     | N, N, Y                      | `smoker`             | Yes    | Header word differs from canonical concept; "tobacco use" is the industry phrasing for smoker risk class.           |
| 12 | `# Deps`      | 2, 3, 0                      | `dependent_count`    | No     | "Deps" reads unambiguously as dependents in a census context.                                                       |

## 4. Sheet B — HRIS Export Q1 2026

Export from an HR information system, 14 columns. Structurally messier, with full-name concatenation, full state names, hourly rates, and multiple columns that a naive mapper will want to force into the schema. Seven columns are genuinely ambiguous.

| #  | Source Header       | Sample Values                          | Gold Canonical Field             | Ambig? | Notes / Why tricky                                                                                                         |
|----|---------------------|----------------------------------------|----------------------------------|--------|----------------------------------------------------------------------------------------------------------------------------|
| 1  | `Payroll_Num`       | P-88021, P-88034, P-88047              | `employee_id`                    | Yes    | Payroll system ID may diverge from employee ID in tenants with separate systems. Best-effort map with flag.                |
| 2  | `Full Name`         | John Q Smith, Maria Garcia Jr.         | `__needs_split__` (first + last) | Yes    | One source column, two canonical fields. Middle initials and suffixes break naive whitespace splits.                       |
| 3  | `DOB`               | 03/12/85, 11/23/75                     | `date_of_birth`                  | No     | Header is canonical. Two-digit year is a value-level normalization issue, not a mapping issue.                             |
| 4  | `Home State`        | California, New York, Texas            | `state`                          | Yes    | Correct concept but wrong format (full names vs USPS 2-letter). Map now, flag value transform.                             |
| 5  | `Postal Code`       | 94107-1234, 10025, 02139-0012          | `zip`                            | No     | ZIP+4 vs 5-digit is a value-level normalization concern; mapping itself is clean.                                          |
| 6  | `Base Rate`         | 40.87, 71.39, 32.50                    | `annual_salary`                  | Yes    | Hourly rate, not annual. Requires value-level x2080 (or x hours-per-year) transform; map + flag, do not transform silently.|
| 7  | `Start Dt`          | 2019-03-04, 2012-07-15                 | `hire_date`                      | No     | Standard HRIS phrasing for hire date.                                                                                      |
| 8  | `FT/PT`             | FT, PT, FT                             | `__unmapped__`                   | Yes    | Schedule classification, orthogonal to `employment_status`. Canonical schema has no home for it.                           |
| 9  | `Policy Amount`     | $250,000, $500,000, $150,000           | `coverage_amount`                | No     | Currency formatting is a value-level concern; header concept is clean.                                                     |
| 10 | `Smoker Status`     | Never, Former, Current                 | `smoker`                         | Yes    | Three-way source vs binary canonical. Map + flag value-set collapse; policy decision on how to bucket "Former".            |
| 11 | `Kids`              | 2, 3, 0                                | `dependent_count`                | Yes    | "Kids" is semantically narrower than "dependents" (excludes spouse, domestic partner). Best-effort map with flag.          |
| 12 | `Notes`             | "contractor until Jun", "", "short-term" | `__unmapped__`                 | No     | Free text has no canonical home.                                                                                           |
| 13 | `Termination Date`  | 2024-03-15, blank, blank               | `__unmapped__`                   | Yes    | Would let v2 infer `employment_status=Termed`, but v1 does not infer across columns.                                       |
| 14 | `Effective Date`    | 2022-01-01, 2023-06-01                 | `__unmapped__`                   | Yes    | Benefit plan effective date, NOT hire date. Silently mapping to `hire_date` corrupts tenure-based underwriting.            |

## 5. Ambiguous columns — deep tradeoff rationale

### FT/PT  (Sheet B)

**Why ambiguous.** The values (`FT`, `PT`) clearly encode *some* kind of employment attribute, and the canonical schema has `employment_status`, which feels like a plausible bucket.

**Naive wrong answer.** Map `FT/PT` → `employment_status`.

**Correct behavior.** `__unmapped__`. Schedule (full-time vs part-time) and status (Active / Termed / Leave) are orthogonal axes: a part-time employee on leave is both `PT` and `Leave`. Collapsing them destroys information and violates the semantics of both fields. The copilot should refuse the mapping and surface FT/PT as a candidate for schema extension discussion.

**Downstream consequence.** If `FT/PT` feeds `employment_status`, every filter built on `employment_status == "Active"` silently excludes or duplicates part-time employees. Group life underwriting, eligibility counts, and benefits gating all go quietly wrong. The corruption is invisible — nothing throws an error.

### Base Rate  (Sheet B)

**Why ambiguous.** "Base Rate" is a compensation concept and pattern-matches to salary. Values (`40.87`, `71.39`, `32.50`) are numeric, but the scale is 3–4 orders of magnitude smaller than what `annual_salary` expects, because these are hourly rates.

**Naive wrong answer.** Map to `annual_salary` and pass the raw value through. A subtler wrong answer is `__unmapped__`, which discards recoverable signal.

**Correct behavior.** Map to `annual_salary` with an explicit **value-transform flag** telling the downstream pipeline to multiply by a standard hours-per-year constant (commonly 2080 for full-time, scaled for FT/PT). The mapping is right; the raw value is not.

**Downstream consequence.** Without the flag, `40.87` sits in `annual_salary` looking like a catastrophically low salary; risk-scoring, premium calculation, and coverage-to-salary ratios all break. Some pricing engines silently exclude rows below a salary floor, making whole cohorts vanish from the quote.

### Effective Date  (Sheet B)

**Why ambiguous.** "Effective Date" in HRIS context is overloaded: hire date, benefit plan effective date, policy effective date, or record-version effective date all share the same header text.

**Naive wrong answer.** Map → `hire_date`. This is the single highest-impact wrong answer in the eval set.

**Correct behavior.** `__unmapped__`, with a comment noting the column is likely benefit plan effective date and asking the customer to confirm. A sophisticated system notices `Start Dt` is already present in the same sheet and that two columns cannot both map to `hire_date`.

**Downstream consequence.** Tenure-based pricing. If `Effective Date` overwrites `hire_date`, a 15-year employee now looks like a 1-year employee, and tenure-weighted rates (disability, voluntary life, age-banded products) silently misprice. Invisible until audit.

### Smoker Status  (Sheet B)

**Why ambiguous.** Header cleanly signals the smoker concept, but value cardinality does not match canonical. Source: `Never`/`Former`/`Current`. Canonical: binary `yes`/`no`. Mapping is unambiguous; the value collapse is a genuine policy decision.

**Naive wrong answer.** Either (1) map and silently collapse without documenting the rule — `Former` gets arbitrarily bucketed — or (2) refuse to map at all, discarding the clear header match.

**Correct behavior.** Map to `smoker` and emit a flag that source has 3 classes while target has 2, requesting an explicit collapse rule from the user. Treating `Former` as `no` after some abstinence window is a common default, but that decision belongs to the carrier, not the mapping system.

**Downstream consequence.** Smoker class drives life and disability premium rates by 1.5x–3x. Silent mis-bucketing moves an applicant population into the wrong risk class, either overpricing (losing sales) or underpricing (losing margin across a book).

### Payroll_Num  (Sheet B)

**Why ambiguous.** In small tenants, payroll number and employee ID are the same thing. In larger or multi-system tenants they diverge: employee ID is the HRIS primary key, payroll number is the payroll vendor's ID, and the two are joined but not identical.

**Naive wrong answer.** Confidently map to `employee_id` with no flag.

**Correct behavior.** Map to `employee_id` (it is the only ID column in the sheet and the canonical schema has one ID slot), but with a low-confidence flag asking the customer to confirm whether `Payroll_Num` is the canonical employee identifier or a separate payroll key requiring a lookup.

**Downstream consequence.** If payroll numbers and employee IDs diverge and are mapped as identical, joins back to the HRIS fail for the divergent subset, producing missing records on dashboards and miscounted census. Classic integration bug that surfaces weeks after go-live.

### Kids  (Sheet B) — secondary

"Kids" narrower-scopes the canonical `dependent_count` concept (which includes spouse and domestic partner). Correct: map to `dependent_count` as best-effort with an undercount flag. Consequence: under-counted dependents mean under-quoted family-tier premiums and under-projected claim reserves.

### Full Name  (Sheet B) — secondary

One source column encodes two canonical fields, with middle initials (`John Q Smith`), suffixes (`Maria Garcia Jr.`), hyphenated surnames (`Dana Wu-Nakamura`), and apostrophes (`Chris O'Neil II`). Correct: emit `__needs_split__` with `split_targets: ["first_name", "last_name"]` and defer the actual split to a parser that handles suffixes and multi-word surnames. Consequence of a naive whitespace split: corrupted names produce duplicate records on re-ingest and break beneficiary lookups.

## 6. Scoring rubric

A system is evaluated on four metrics, computed per sheet and averaged. `N` = number of source columns in the sheet.

**Top-1 accuracy.** Fraction of columns for which the system's top proposal equals the gold label. Split targets (`__needs_split__`) count as correct only if both the sentinel and the target list match. Formula: `correct_top1 / N`.

**Ambiguity-handled rate.** Restricted to columns flagged `Ambig? = Yes` in gold (4 on Sheet A, 7 on Sheet B — 11 total). Handled means either (a) correct mapping plus a flag/low-confidence marker, or (b) `__unmapped__` when that was the gold answer. Formula: `handled_ambiguous / total_ambiguous`.

**Unmapped precision and recall.** Precision = of columns the system marked `__unmapped__`, fraction truly unmapped in gold. Recall = of truly unmapped columns, fraction correctly identified. Both matter: a lazy system marking everything unmapped has high recall and zero precision; an over-eager system never refusing has zero recall. Gold has 4 `__unmapped__` entries (all Sheet B: `FT/PT`, `Notes`, `Termination Date`, `Effective Date`).

**Refusal discipline.** Weighted penalty for the two most dangerous failure modes: confident-wrong on a truly ambiguous column, and confident-mapping of a truly unmapped column. Each event subtracts a weight `w` from the score, larger for high-stakes errors (`Effective Date` → `hire_date`, `Base Rate` → `annual_salary` without flag, `FT/PT` → `employment_status`).

Composite = `0.4 * top1 + 0.3 * ambiguity_handled + 0.2 * F1(unmapped) + 0.1 * refusal_discipline`, where `refusal_discipline` starts at 1.0 and loses `w` per high-stakes error. A naive header-only system lands around 0.55; a system that uses sample values and flags ambiguity lands around 0.85. Perfect is 1.0.

## 7. Notes on generation

All values in these fixtures are fictional. Names come from a clearly-invented roster (Avery Chen, Jordan Patel, Taylor Kim, Marcus Lee, Priya Rao, Sam Rivera, Alex Park, Dana Wu, plus variants in Sheet B) and contain no real PII. Employee IDs, ZIP codes, dates, salary and coverage figures, and payroll numbers are pattern-preserving synthetic values chosen to exercise value-level concerns (ZIP+4 vs 5-digit, MM/DD/YY vs ISO, hourly decimals vs annual integers, currency formatting, three-way smoker status) without resembling any real record. The sheets are extrapolated from common real-world broker census and HRIS export conventions so the eval is representative of what the copilot will encounter in production, and the archetypes generalize cleanly to the 200-column offline eval set that will grade future versions.
