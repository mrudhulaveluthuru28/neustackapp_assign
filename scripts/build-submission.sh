#!/usr/bin/env bash
# Rebuilds SUBMISSION.md + SUBMISSION.pdf + SUBMISSION.docx from the three
# source markdown files. Run from repo root:
#
#   ./scripts/build-submission.sh
#
# Requirements: pandoc + weasyprint (install with `brew install pandoc` and
# `pip install weasyprint`).

set -euo pipefail

cd "$(dirname "$0")/.."

{
cat <<'COVER'
---
title: "AI Mapping Copilot"
subtitle: "Take-home submission — Neustack"
author: "Ashish Cheruku · achicheruku@gmail.com"
date: "April 20, 2026"
---

## Submission resources

- **GitHub repo:** <https://github.com/ashish-cheruku/neustackapp_assignment>
- **Live URL (after Vercel deploy):** to be filled in at submission
- **Working MVP:** the repo contains a Next.js 16 app that demos the entire flow end-to-end. Run with `npm install && npm run dev` or deploy to Vercel.

## What this document contains

This packet combines the three assignment-required artifacts:

- **Part I — Spec Packet** (7 sections + 3 appendices)
- **Part II — Hands-On Artifact, Option A:** Mini Evaluation Set (2 sheets × 12/14 columns, gold mappings, 9 ambiguous cases)
- **Part III — AI Collaboration Log** (3 real prompts with verbatim outputs and honest critiques)

Everything below appears in the GitHub repo as individual markdown files; this PDF is a single-document convenience for the review panel.

---

COVER
echo ""
echo "# Part I — Spec Packet"
echo ""
cat SPEC_PACKET.md
echo ""
echo ""
echo "---"
echo ""
echo "# Part II — Hands-On Artifact: Mini Evaluation Set (Option A)"
echo ""
cat EVAL_SET.md
echo ""
echo ""
echo "---"
echo ""
echo "# Part III — AI Collaboration Log"
echo ""
cat AI_COLLAB_LOG.md
} > SUBMISSION.md

echo "wrote SUBMISSION.md ($(wc -l < SUBMISSION.md) lines)"

pandoc SUBMISSION.md \
  -o SUBMISSION.pdf \
  --pdf-engine=weasyprint \
  --toc --toc-depth=2 \
  --metadata title="AI Mapping Copilot — Submission Packet" \
  -V margin-top=0.7in -V margin-bottom=0.7in -V margin-left=0.85in -V margin-right=0.85in
echo "wrote SUBMISSION.pdf ($(wc -c < SUBMISSION.pdf) bytes)"

pandoc SUBMISSION.md -o SUBMISSION.docx --toc --toc-depth=2
echo "wrote SUBMISSION.docx ($(wc -c < SUBMISSION.docx) bytes)"
