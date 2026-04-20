// POST /api/propose
// Accepts a batch of source columns, returns one Proposal per column.
// Uses Claude (tool-use for structured output) when ANTHROPIC_API_KEY is set;
// falls back to pre-baked fixtures otherwise (demo mode).

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  ALLOWED_OUTPUTS,
  UNMAPPED,
  type ProposedField,
  type CanonicalField,
} from "@/lib/canonical";
import { SYSTEM_PROMPT, TOOL_DEFINITION, PROMPT_VERSION } from "@/lib/prompt";
import { scrubSamples } from "@/lib/pii-scrub";
import { loadDemoFixtures } from "@/lib/demo-fixtures";
import type {
  Alternative,
  Proposal,
  ProposeRequest,
  ProposeResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  let body: ProposeRequest;
  try {
    body = (await request.json()) as ProposeRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body?.columns) || body.columns.length === 0) {
    return NextResponse.json(
      { error: "Request must include a non-empty columns array" },
      { status: 400 },
    );
  }

  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const requestedDemo = body.mode === "demo";
  const useDemo = requestedDemo || !hasKey;

  if (useDemo) {
    const started = Date.now();
    const proposals = await loadDemoFixtures(body.columns);
    const payload: ProposeResponse = {
      proposals,
      model: "demo-fixture",
      prompt_version: PROMPT_VERSION,
      latency_ms: Date.now() - started,
      source: "demo",
    };
    return NextResponse.json(payload);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const started = Date.now();

  // Per-column isolation: one LLM call per column, parallelized. A bad
  // inference on column 3 cannot poison column 7.
  const proposals = await Promise.all(
    body.columns.map((col) => proposeOne(client, col)),
  );

  const payload: ProposeResponse = {
    proposals,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    latency_ms: Date.now() - started,
    source: "live",
  };
  return NextResponse.json(payload);
}

async function proposeOne(
  client: Anthropic,
  col: { header: string; samples: string[] },
): Promise<Proposal> {
  const scrubbed = scrubSamples(col.samples);
  const userMessage = `Source column header: ${JSON.stringify(col.header)}
Sample values (pre-scrubbed for PII): ${JSON.stringify(scrubbed)}

Call propose_mapping exactly once with your decision.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "tool", name: TOOL_DEFINITION.name },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Model did not produce a tool_use block");
    }

    const input = toolBlock.input as Record<string, unknown>;
    const field = String(input.proposed_field ?? "");
    if (!ALLOWED_OUTPUTS.has(field)) {
      throw new Error(`Invalid proposed_field: ${field}`);
    }

    const alternatives = Array.isArray(input.alternatives)
      ? (input.alternatives as Alternative[]).filter(
          (a) => a && ALLOWED_OUTPUTS.has(String(a.field)),
        )
      : undefined;

    const splitTargets = Array.isArray(input.split_targets)
      ? (input.split_targets as CanonicalField[])
      : undefined;

    return {
      source_header: col.header,
      samples: scrubbed,
      proposed_field: field as ProposedField,
      confidence: clampInt(input.confidence, 0, 100),
      rationale: String(input.rationale ?? "").slice(0, 200),
      alternatives,
      split_targets: splitTargets,
      value_warning:
        typeof input.value_warning === "string"
          ? input.value_warning.slice(0, 200)
          : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return {
      source_header: col.header,
      samples: scrubbed,
      proposed_field: UNMAPPED,
      confidence: 0,
      rationale: `Fallback: LLM call failed (${message}). Human review required.`,
    };
  }
}

function clampInt(value: unknown, lo: number, hi: number): number {
  const n = Math.round(Number(value ?? 0));
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
