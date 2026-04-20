"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, ArrowRight, ArrowLeft, Rocket, Info } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DemoLoader } from "@/components/DemoLoader";
import { TopNav } from "@/components/TopNav";
import { Sidebar } from "@/components/Sidebar";
import { AlertBanner } from "@/components/AlertBanner";
import { MappingTable } from "@/components/MappingTable";
import { AiReasoningPanel } from "@/components/AiReasoningPanel";
import { StatsBanner } from "@/components/StatsBanner";
import { ModelStatusCard } from "@/components/ModelStatusCard";
import { SourceDataProfile } from "@/components/SourceDataProfile";
import { DataQualityCard } from "@/components/DataQualityCard";
import { Stepper, type StepId } from "@/components/Stepper";
import type { ReviewEntry } from "@/components/ReviewPanel";
import {
  confidenceLane,
  NEEDS_SPLIT,
  UNMAPPED,
  type CanonicalField,
  type ProposedField,
} from "@/lib/canonical";
import {
  buildCanonical,
  downloadText,
  type ColumnDecision,
} from "@/lib/canonical-csv";
import type { ParsedSheet } from "@/lib/csv-utils";
import type { ProposeResponse } from "@/lib/types";
import { cn } from "@/lib/ui";

type Phase = "idle" | "proposing" | "mapping" | "review" | "published";

interface SessionState {
  filename: string;
  sheet: ParsedSheet;
  response: ProposeResponse;
  reviews: Record<string, ReviewEntry>;
}

const REQUIRED: CanonicalField[] = ["employee_id", "date_of_birth", "state", "zip"];

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedHeader, setSelectedHeader] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  const runProposal = useCallback(
    async (sheet: ParsedSheet, filename: string, mode?: "demo") => {
      setError(null);
      setPhase("proposing");
      setBannerDismissed(false);
      setPublishConfirmed(false);
      try {
        const res = await fetch("/api/propose", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            columns: sheet.columnSamples,
            ...(mode ? { mode } : {}),
          }),
        });
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
        const data = (await res.json()) as ProposeResponse;
        const reviews: Record<string, ReviewEntry> = {};
        for (const p of data.proposals) {
          reviews[p.source_header] = {
            proposal: p,
            effective_field: p.proposed_field,
            ignored: false,
          };
        }
        setSession({ filename, sheet, response: data, reviews });
        setSelectedHeader(data.proposals[0]?.source_header ?? null);
        setPhase("mapping");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("idle");
      }
    },
    [],
  );

  const updateEntry = useCallback(
    (header: string, update: Partial<ReviewEntry>) => {
      setSession((prev) => {
        if (!prev) return prev;
        const entry = prev.reviews[header];
        if (!entry) return prev;
        return {
          ...prev,
          reviews: { ...prev.reviews, [header]: { ...entry, ...update } },
        };
      });
    },
    [],
  );

  const onChangeField = useCallback(
    (header: string, field: ProposedField) => {
      updateEntry(header, { effective_field: field });
    },
    [updateEntry],
  );

  const onAccept = useCallback(
    (header: string) => {
      setSelectedHeader(header);
      // Accept is idempotent: ensures effective_field equals proposal unless user already changed it.
      setSession((prev) => {
        if (!prev) return prev;
        const entry = prev.reviews[header];
        if (!entry) return prev;
        // If edited, keep current effective_field; otherwise make explicit.
        return {
          ...prev,
          reviews: {
            ...prev.reviews,
            [header]: { ...entry, ignored: false },
          },
        };
      });
    },
    [],
  );

  const onToggleIgnore = useCallback(
    (header: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const entry = prev.reviews[header];
        if (!entry) return prev;
        return {
          ...prev,
          reviews: {
            ...prev.reviews,
            [header]: { ...entry, ignored: !entry.ignored },
          },
        };
      });
    },
    [],
  );

  const acceptAllHighConfidence = useCallback(() => {
    if (!session) return;
    // No-op really — high-confidence rows are already in the "accepted" posture
    // because effective_field = proposal.proposed_field by default. Clicking
    // this dismisses the banner for the user.
    setBannerDismissed(true);
  }, [session]);

  const entries = useMemo(
    () => (session ? Object.values(session.reviews) : []),
    [session],
  );

  const counts = useMemo(() => {
    const c = { total: 0, ready: 0, review: 0, blocked: 0, ignored: 0, edited: 0 };
    for (const e of entries) {
      c.total += 1;
      if (e.ignored) {
        c.ignored += 1;
        continue;
      }
      if (e.effective_field !== e.proposal.proposed_field) c.edited += 1;
      // An explicit __unmapped__ decision is a valid outcome (model refused or user chose skip).
      // Treat it as ready — not blocked — so it doesn't gate publish.
      if (e.effective_field === UNMAPPED) {
        c.ready += 1;
        continue;
      }
      const topDelta =
        e.proposal.alternatives && e.proposal.alternatives.length > 0
          ? e.proposal.confidence - e.proposal.alternatives[0].confidence
          : undefined;
      const lane = confidenceLane(e.proposal.confidence, topDelta);
      if (lane === "green") c.ready += 1;
      else if (lane === "yellow") c.review += 1;
      else c.blocked += 1;
    }
    return c;
  }, [entries]);

  const decisions: ColumnDecision[] = useMemo(
    () =>
      entries.map((e) => ({
        source_header: e.proposal.source_header,
        effective_field: e.effective_field,
        split_targets: e.proposal.split_targets,
        ignored: e.ignored,
      })),
    [entries],
  );

  const missingRequired = useMemo<CanonicalField[]>(() => {
    const touched = new Set<string>();
    for (const d of decisions) {
      if (d.ignored) continue;
      if (d.effective_field === UNMAPPED) continue;
      if (d.effective_field === NEEDS_SPLIT) {
        (d.split_targets ?? ["first_name", "last_name"]).forEach((t) =>
          touched.add(t),
        );
      } else {
        touched.add(d.effective_field);
      }
    }
    return REQUIRED.filter((f) => !touched.has(f));
  }, [decisions]);

  const canPublish =
    counts.blocked === 0 && missingRequired.length === 0 && !!session;

  const proceedToReview = useCallback(() => {
    if (!canPublish) return;
    setPhase("review");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [canPublish]);

  const backToMap = useCallback(() => setPhase("mapping"), []);

  const publish = useCallback(() => {
    if (!session || !canPublish) return;
    setPublishing(true);
    try {
      const output = buildCanonical({
        headers: session.sheet.headers,
        rows: session.sheet.rows,
        decisions,
      });
      const stem = session.filename.replace(/\.csv$/i, "") || "canonical";
      downloadText(`${stem}_canonical.csv`, output.canonicalCsv, "text/csv");
      downloadText(
        `${stem}_mapping.json`,
        output.mappingJson,
        "application/json",
      );
      setPhase("published");
    } finally {
      setPublishing(false);
    }
  }, [session, canPublish, decisions]);

  const reset = useCallback(() => {
    setSession(null);
    setError(null);
    setSelectedHeader(null);
    setPhase("idle");
    setBannerDismissed(false);
    setPublishConfirmed(false);
  }, []);

  const stepperId: StepId =
    phase === "idle"
      ? "upload"
      : phase === "proposing" || phase === "mapping"
        ? "map"
        : phase === "review"
          ? "review"
          : "publish";

  const selectedEntry =
    session && selectedHeader ? session.reviews[selectedHeader] : null;

  const wideLayout = phase === "mapping";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav active={stepperId} />
      <div className="flex flex-1">
        <Sidebar
          onRunValidation={proceedToReview}
          meta={
            session
              ? {
                  filename: session.filename,
                  source: session.response.source,
                  model: session.response.model,
                  promptVersion: session.response.prompt_version,
                  latencyMs: session.response.latency_ms,
                  columns: session.sheet.columnSamples.length,
                }
              : undefined
          }
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {phase === "idle" && (
            <IdleShell>
              <IdleView onParsed={runProposal} error={error} />
            </IdleShell>
          )}

          {phase === "proposing" && (
            <IdleShell>
              <ProposingView
                columnCount={session?.sheet.columnSamples.length ?? 0}
              />
            </IdleShell>
          )}

          {phase === "mapping" && session && (
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col gap-6 p-8">
                {!bannerDismissed && counts.blocked + counts.review > 0 && (
                  <AlertBanner
                    count={counts.blocked + counts.review}
                    onDismiss={() => setBannerDismissed(true)}
                  />
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                      Mapping Review
                    </h1>
                    <p className="mt-1 max-w-xl text-sm text-zinc-500">
                      Review AI-suggested alignments between source data and
                      system standards.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={acceptAllHighConfidence}
                      className="border border-zinc-300 bg-white px-4 py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-zinc-900 hover:bg-zinc-50"
                    >
                      ACCEPT ALL HIGH-CONFIDENCE
                    </button>
                    <button
                      type="button"
                      onClick={proceedToReview}
                      disabled={!canPublish}
                      className={cn(
                        "flex items-center gap-1.5 bg-zinc-900 px-4 py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-white hover:bg-zinc-800",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      REVIEW &amp; APPROVE
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <MappingTable
                  entries={entries}
                  selectedHeader={selectedHeader}
                  onSelect={setSelectedHeader}
                  onAccept={onAccept}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SourceDataProfile entries={entries} />
                  <div className="flex flex-col gap-4">
                    <DataQualityCard
                      readyPct={(counts.ready / Math.max(1, counts.total - counts.ignored)) * 100}
                      ignoredPct={(counts.ignored / Math.max(1, counts.total)) * 100}
                    />
                    <div className="min-h-[160px]">
                      <ModelStatusCard
                        status={session.response.source === "live" ? "OPTIMIZED" : "DEMO MODE"}
                        modelName={
                          session.response.source === "live"
                            ? `${session.response.model.toUpperCase()} · ${session.response.latency_ms}MS`
                            : "PRE-BAKED FIXTURES · SET ANTHROPIC_API_KEY"
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <AiReasoningPanel
                proposal={selectedEntry?.proposal ?? null}
                effectiveField={selectedEntry?.effective_field ?? null}
                ignored={selectedEntry?.ignored ?? false}
                onChangeField={(f) =>
                  selectedEntry && onChangeField(selectedEntry.proposal.source_header, f)
                }
                onAccept={() =>
                  selectedEntry && onAccept(selectedEntry.proposal.source_header)
                }
                onToggleIgnore={() =>
                  selectedEntry &&
                  onToggleIgnore(selectedEntry.proposal.source_header)
                }
              />
            </div>
          )}

          {phase === "review" && session && (
            <FinalReviewView
              session={session}
              entries={entries}
              counts={counts}
              missingRequired={missingRequired}
              publishConfirmed={publishConfirmed}
              setPublishConfirmed={setPublishConfirmed}
              onBack={backToMap}
              onPublish={publish}
              publishing={publishing}
            />
          )}

          {phase === "published" && <PublishedView onReset={reset} />}
        </main>
      </div>
      <footer className="border-t border-zinc-200 bg-white px-8 py-3 text-center font-mono text-[10px] tracking-[0.15em] text-zinc-400">
        AI MAPPING COPILOT · PROTOTYPE · SEE SPEC_PACKET.MD FOR FULL DESIGN DOC
      </footer>
    </div>
  );
}

function IdleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-12">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

function IdleView({
  onParsed,
  error,
}: {
  onParsed: (sheet: ParsedSheet, filename: string, mode?: "demo") => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
          STEP 01 · UPLOAD
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
          Upload a census file.
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Claude maps your headers to our 12-field canonical schema with
          confidence + rationale. You review, edit, and publish. Sample values
          are scrubbed for PII before leaving your browser.
        </p>
      </div>

      <UploadDropzone onParsed={(s, f) => onParsed(s, f)} />

      <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200" />
        OR TRY A SAMPLE
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <DemoLoader onParsed={(s, f) => onParsed(s, f, "demo")} />

      <div className="flex items-start gap-2 border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span>
          Without <code className="font-mono text-zinc-900">ANTHROPIC_API_KEY</code>
          , the API falls back to pre-baked proposals for the sample sheets.
          Set the env var on the server to run live with{" "}
          <code className="font-mono text-zinc-900">claude-sonnet-4-6</code>.
        </span>
      </div>

      {error && (
        <div className="border-l-4 border-rose-600 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      )}
    </div>
  );
}

function ProposingView({ columnCount }: { columnCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-zinc-300 bg-zinc-50 py-24 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      <div className="text-sm font-semibold text-zinc-900">
        Proposing mappings for {columnCount} column{columnCount === 1 ? "" : "s"}…
      </div>
      <div className="font-mono text-[10px] tracking-[0.15em] text-zinc-500">
        TEMPERATURE 0 · CLOSED-VOCAB OUTPUT · PROMPT CACHED
      </div>
    </div>
  );
}

function FinalReviewView({
  session,
  entries,
  counts,
  missingRequired,
  publishConfirmed,
  setPublishConfirmed,
  onBack,
  onPublish,
  publishing,
}: {
  session: SessionState;
  entries: ReviewEntry[];
  counts: {
    total: number;
    ready: number;
    review: number;
    blocked: number;
    ignored: number;
    edited: number;
  };
  missingRequired: CanonicalField[];
  publishConfirmed: boolean;
  setPublishConfirmed: (v: boolean) => void;
  onBack: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const canPublish =
    counts.blocked === 0 && missingRequired.length === 0 && publishConfirmed;
  return (
    <div className="flex flex-col gap-6 p-8">
      <Stepper active="review" className="my-4" />

      <StatsBanner
        total={counts.total}
        autoMapped={counts.ready - counts.edited}
        edited={counts.edited}
        unresolved={counts.blocked + missingRequired.length}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-zinc-900">
            Final Mapping Review
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Verify the relationship between source data and destination schema
            before final publication to the production environment.
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] tracking-[0.2em] text-zinc-500">
            STATUS
          </div>
          <div
            className={cn(
              "mt-2 inline-block border px-4 py-1.5 font-mono text-[11px] font-semibold tracking-[0.15em]",
              canPublish || (counts.blocked === 0 && missingRequired.length === 0)
                ? "border-zinc-900 text-zinc-900"
                : "border-rose-300 text-rose-700",
            )}
          >
            {counts.blocked === 0 && missingRequired.length === 0
              ? "READY FOR PUBLISH"
              : "BLOCKED"}
          </div>
        </div>
      </div>

      <FinalMappingTable entries={entries} session={session} />

      {missingRequired.length > 0 && (
        <div className="border-l-4 border-rose-600 bg-rose-50 p-3 text-xs text-rose-900">
          Missing required canonical field
          {missingRequired.length === 1 ? "" : "s"}:{" "}
          <span className="font-mono font-semibold">
            {missingRequired.join(", ")}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-zinc-200 pt-6">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={publishConfirmed}
            onChange={(e) => setPublishConfirmed(e.target.checked)}
            className="h-4 w-4 accent-zinc-900"
          />
          I have reviewed these mappings and approve them for publish.
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 border border-zinc-300 bg-white px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-zinc-900 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> GO BACK AND EDIT
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={!canPublish || publishing}
            className={cn(
              "flex items-center gap-1.5 bg-zinc-900 px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-white hover:bg-zinc-800",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {publishing ? "PUBLISHING…" : "APPROVE & PUBLISH SCHEMA"}
            <Rocket className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FinalMappingTable({
  entries,
  session,
}: {
  entries: ReviewEntry[];
  session: SessionState;
}) {
  return (
    <div className="overflow-hidden border border-zinc-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {["SOURCE COLUMN", "DATA TYPE", "TARGET SCHEMA FIELD", "CONFIDENCE", "METHOD"].map(
              (h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left font-mono text-[10px] font-semibold tracking-[0.15em] text-zinc-600"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {entries
            .filter((e) => !e.ignored && e.effective_field !== UNMAPPED)
            .map((e) => {
              const edited = e.effective_field !== e.proposal.proposed_field;
              const method = edited
                ? "EDITED"
                : session.response.source === "live"
                  ? "AUTO"
                  : "DEMO";
              return (
                <tr
                  key={e.proposal.source_header}
                  className="border-b border-zinc-100 last:border-b-0"
                >
                  <td className="px-5 py-3.5 font-mono text-sm text-zinc-900">
                    {e.proposal.source_header}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs uppercase text-zinc-500">
                    {inferType(e.proposal.samples)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-sm font-semibold uppercase text-zinc-900">
                    {e.effective_field === NEEDS_SPLIT
                      ? "FIRST_NAME + LAST_NAME"
                      : e.effective_field}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          e.proposal.confidence >= 95
                            ? "bg-emerald-500"
                            : e.proposal.confidence >= 70
                              ? "bg-amber-500"
                              : "bg-rose-500",
                        )}
                      />
                      <span className="font-sans text-sm tabular-nums text-zinc-700">
                        {e.proposal.confidence.toFixed(1)}%
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-zinc-700">
                    {method}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

function inferType(samples: string[]): string {
  if (!samples.length) return "string";
  const s = samples[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2}\/\d{2}\/\d{2,4}$/.test(s))
    return "date";
  if (/^\$?\d+(,\d{3})*(\.\d+)?$/.test(s) || /^\d+\.\d+$/.test(s))
    return "decimal";
  if (/^\d+$/.test(s)) return "integer";
  return "string";
}

function PublishedView({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-12">
      <div className="flex h-16 w-16 items-center justify-center border-2 border-zinc-900">
        <Rocket className="h-7 w-7 text-zinc-900" />
      </div>
      <div className="text-center">
        <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-emerald-600">
          STEP 04 · PUBLISH — COMPLETE
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Canonical schema published.
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          Canonical CSV and mapping audit JSON have been downloaded. The
          mapping would also be persisted to tenant memory for automatic reuse
          on matching future uploads.
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="bg-zinc-900 px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-white hover:bg-zinc-800"
      >
        START OVER
      </button>
    </div>
  );
}
