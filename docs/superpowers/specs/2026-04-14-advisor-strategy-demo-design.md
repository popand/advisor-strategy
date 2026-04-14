# Advisor Strategy Demo — Design Spec

**Date:** 2026-04-14  
**Author:** Andrei Pop  
**Purpose:** Technical demo + LinkedIn marketing material showcasing Anthropic's advisor strategy

---

## Overview

A Next.js web application that runs a parametric research agent in three configurations simultaneously — Sonnet solo (baseline), Sonnet + Opus advisor (sweet spot), and Opus solo (gold standard) — and displays a full side-by-side comparison of output quality, token usage, cost, and latency. The primary outputs are: (1) a screen recording for LinkedIn, and (2) a public GitHub repository.

---

## Goals

- Demonstrate the advisor strategy's cost/quality tradeoff empirically with real data
- Show that Sonnet + Opus advisor achieves near-Opus quality at significantly lower cost than Opus solo
- Produce compelling, shareable metrics for a technical LinkedIn audience
- Provide a reusable demo that works for any research query

---

## Architecture

Single Next.js 15 App Router application. No separate backend process.

```
advisor-strategy/
├── app/
│   ├── page.tsx                        # Main UI — query input + three-column results
│   ├── layout.tsx                      # Root layout with Geist fonts, canvas bg
│   ├── globals.css                     # Base styles
│   └── api/
│       ├── research/
│       │   ├── baseline/route.ts       # Sonnet solo agent (streaming SSE)
│       │   ├── advisor/route.ts        # Sonnet + Opus advisor agent (streaming SSE)
│       │   └── opus/route.ts           # Opus solo agent (streaming SSE)
│       └── judge/route.ts              # Quality scoring via separate Opus call
├── lib/
│   ├── agents/
│   │   ├── baseline-agent.ts           # Sonnet-only research agent
│   │   ├── advisor-agent.ts            # Sonnet executor + Opus advisor
│   │   └── opus-agent.ts               # Opus solo research agent
│   ├── metrics.ts                      # Token counting, cost calculation, pricing constants
│   └── quality.ts                      # Judge model scoring (4 dimensions)
├── components/
│   ├── ResearchForm.tsx                # Query input + "Run Comparison" button
│   ├── ComparisonGrid.tsx              # Three-column layout container
│   ├── AgentColumn.tsx                 # Single agent column (output + metrics)
│   ├── MetricsCard.tsx                 # Token/cost/latency/advisor call display
│   ├── QualityRadar.tsx                # 4-dimension quality score visualization
│   └── SummaryBar.tsx                  # Auto-generated summary stat at bottom
├── tailwind.config.ts                  # Anti-AI design system config
└── .env.local                          # ANTHROPIC_API_KEY
```

---

## Agent Logic

### Shared constraints (all three variants)
- Identical system prompt
- Identical tools: web search + URL fetch
- Identical research query (user-provided at runtime)
- The ONLY variable is model configuration

### Baseline agent (`baseline-agent.ts`)
- Model: `claude-sonnet-4-6`
- No advisor
- Streams output via SSE
- Reports: input tokens, output tokens, cache read tokens, cost, latency, tool call count

### Advisor agent (`advisor-agent.ts`)
- Executor model: `claude-sonnet-4-5`
- Advisor model: `claude-opus-4-6`
- Beta header: `anthropic-beta: advisor-tool-2026-03-01`
- Tool in messages API: `advisor_20260301`
- `max_uses` parameter: 5 (caps advisor calls per run for cost control)
- Executor streams output; advisor calls are tracked and counted
- Reports: executor input/output tokens, advisor tokens (billed at Opus rates), total cost, latency, advisor call count, tool call count

### Opus agent (`opus-agent.ts`)
- Model: `claude-opus-4-6`
- No advisor
- Same tools as baseline
- This is the quality ceiling / cost ceiling reference point

### Quality judge (`quality.ts`)
- Runs after all three agents complete
- Separate Opus call with structured output
- Scores each output 1–10 on four dimensions:
  1. **Source depth** — number and quality of sources cited
  2. **Reasoning quality** — logical structure, handling of tradeoffs
  3. **Completeness** — coverage of all relevant angles
  4. **Accuracy confidence** — internal consistency, no unsupported claims
- Returns JSON: `{ sourcDepth: number, reasoning: number, completeness: number, accuracy: number, overall: number }`
- Overall = average of four dimensions

---

## Metrics

### Per-run metrics (displayed in each column)

| Metric | Baseline | Advisor | Opus |
|--------|----------|---------|------|
| Input tokens | ✓ | ✓ (executor) | ✓ |
| Output tokens | ✓ | ✓ (executor) | ✓ |
| Cache read tokens | ✓ | ✓ | ✓ |
| Advisor tokens | — | ✓ (Opus rate) | — |
| Estimated cost ($) | ✓ | ✓ | ✓ |
| Latency (ms) | ✓ | ✓ | ✓ |
| Tool calls | ✓ | ✓ | ✓ |
| Advisor calls | — | ✓ | — |
| Tokens/sec | ✓ | ✓ | ✓ |

### Pricing constants (`metrics.ts`)
Use current Anthropic published rates. Constants defined as named values, easy to update.

### Quality scores
Four per-dimension scores + overall, displayed as a 4-bar comparison across all three variants.

### Derived metrics (summary bar)
- Quality-per-dollar ratio (overall score / cost) — the key ROI metric
- Advisor quality vs. Opus: `X% of Opus quality`
- Advisor cost vs. Opus: `Y% of the cost`
- Auto-generated summary string: `"Advisor strategy: X% Opus quality at Y% of the cost. Z advisor calls."`

---

## UI Design

### Design system
Applies Andrei's Anti-AI structural aesthetic from the Scout brand system.

**Palette:**
- Canvas: `#0A0A0A`
- Surface: `#121212` / `#171717` / `#1E1E1E`
- Content: `#FAFAFA` / muted `#A1A1AA`
- Divider: `rgba(255,255,255,0.1)`
- Accent: `#06B6D4` (soft cyan — data/analytics)

**Typography:** Geist Sans + Geist Mono via `next/font`. Display tracking `-0.03em`. Body `text-sm`. Metrics in Geist Mono.

**Layout:** Centered Narrative (Layout B). Single page, no routing.

### Page structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  [header: "Advisor Strategy" in Geist Mono, muted subtitle]          │
├──────────────────────────────────────────────────────────────────────┤
│  Research Query: [________________________________] [Run Comparison]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────┐  ┌─────────────────────┐  ┌────────────────────┐ │
│  │ SONNET SOLO    │  │ SONNET + ADVISOR     │  │ OPUS SOLO          │ │
│  │ Baseline       │  │ ★ SWEET SPOT        │  │ Gold Standard      │ │
│  ├────────────────┤  ├─────────────────────┤  ├────────────────────┤ │
│  │ streaming...   │  │ streaming...        │  │ streaming...       │ │
│  │                │  │ [advisor call #1]   │  │                    │ │
│  │ [output text]  │  │ [output text]       │  │ [output text]      │ │
│  ├────────────────┤  ├─────────────────────┤  ├────────────────────┤ │
│  │ Cost: $0.00X   │  │ Cost: $0.0XX        │  │ Cost: $0.XXX       │ │
│  │ Tokens: X,XXX  │  │ Advisor calls: X    │  │ Tokens: X,XXX      │ │
│  │ Latency: Xs    │  │ Latency: Xs         │  │ Latency: Xs        │ │
│  │ Quality: X/10  │  │ Quality: X/10       │  │ Quality: X/10      │ │
│  └────────────────┘  └─────────────────────┘  └────────────────────┘ │
│                                                                        │
│  [Quality radar: 4-dimension bars across all 3 variants]              │
│                                                                        │
├──────────────────────────────────────────────────────────────────────┤
│  SUMMARY: Advisor gets X% of Opus quality at Y% of the cost          │
└──────────────────────────────────────────────────────────────────────┘
```

### Component rules
- Advisor column: `border-accent/50` + mono `★ SWEET SPOT` label in accent color
- All cards: `flex flex-col bg-surface shadow-stamped rounded-lg`
- Metrics grid inside card: `flex flex-1 flex-col gap-3 font-mono text-sm`
- Streaming text area: `bg-black/40 border border-divider rounded-lg p-4 font-mono text-sm overflow-y-auto`
- Advisor call indicators: small inline badges (`[advisor call #N]`) in accent/30 bg as they appear
- Summary bar: `bg-surface border-t border-divider px-6 py-4`; summary string in `text-accent`
- All transitions: `ease-snappy` (`cubic-bezier(0.16,1,0.3,1)`), `duration-250`
- NO hover:scale anywhere. Icon slides and border illumination only.
- Icons: Lucide React, `strokeWidth={1.5}`, 24px

### Streaming behavior
- All three API routes respond with `text/event-stream`
- UI fires all three fetch calls in parallel on "Run Comparison"
- Each column updates independently as tokens arrive
- Advisor call events (`type: "advisor_call"`) render inline badges in the output stream
- Metrics section updates live as token counts accumulate
- Summary bar appears and populates once all three runs + judge call complete

---

## Data Flow

```
User submits query
       │
       ├─── POST /api/research/baseline  (SSE stream)
       ├─── POST /api/research/advisor   (SSE stream)
       └─── POST /api/research/opus      (SSE stream)
                    │
              [all complete]
                    │
              POST /api/judge
              (scores all 3 outputs)
                    │
              SummaryBar renders
```

SSE event types:
- `{ type: "token", content: string }` — text chunk
- `{ type: "advisor_call", callNumber: number }` — advisor consulted
- `{ type: "tool_call", name: string }` — search or fetch
- `{ type: "metrics", data: MetricsSnapshot }` — running totals
- `{ type: "done", finalMetrics: FinalMetrics }` — run complete

---

## Environment

```
ANTHROPIC_API_KEY=sk-ant-...
```

Single key. All three agents use the same key. The advisor beta feature is enabled via request header, not a separate key.

---

## GitHub / Distribution

- Repo: `github.com/popand/advisor-strategy` (public)
- README: explains the advisor strategy, how to run locally, what the metrics mean
- `.env.example` with placeholder key
- No deployment required — screen recording is the distribution format

---

## LinkedIn Post Strategy

The post leads with the empirically measured summary stat from a real run, e.g.:
> *"I ran the same research query through Sonnet, Sonnet + Opus advisor, and Opus. The advisor strategy got 94% of Opus quality at 31% of the cost. Here's the data."*

Supporting visuals:
1. Screen recording of the three columns filling in real-time
2. Screenshot of the final metrics dashboard
3. Link to the GitHub repo

The post narrative mirrors the Anthropic article's framing: selective escalation, cost efficiency, quality ceiling vs. sweet spot.

---

## Out of Scope

- Authentication / user accounts
- Saving/persisting runs
- Deployment to a live URL
- Mobile optimization (demo is desktop-only for screen recording purposes)
- Multiple simultaneous users
