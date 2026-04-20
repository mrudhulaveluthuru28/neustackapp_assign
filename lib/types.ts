// Shared types for the propose API and the review UI.

import type { CanonicalField, ProposedField } from "./canonical";

export interface Alternative {
  field: ProposedField;
  confidence: number;
}

export interface Proposal {
  source_header: string;
  samples: string[];
  proposed_field: ProposedField;
  confidence: number;
  rationale: string;
  alternatives?: Alternative[];
  split_targets?: CanonicalField[];
  value_warning?: string;
}

export type UserActionKind = "pending" | "accepted" | "swapped" | "ignored";

export interface UserAction {
  kind: UserActionKind;
  to?: ProposedField;
}

export interface ReviewedColumn {
  proposal: Proposal;
  action: UserAction;
}

export interface ProposeRequestColumn {
  header: string;
  samples: string[];
}

export interface ProposeRequest {
  columns: ProposeRequestColumn[];
  mode?: "live" | "demo" | "auto";
}

export interface ProposeResponse {
  proposals: Proposal[];
  model: string;
  prompt_version: string;
  latency_ms: number;
  source: "live" | "demo";
}
