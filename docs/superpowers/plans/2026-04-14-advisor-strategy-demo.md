# Advisor Strategy Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app that runs the same research query through three Claude configurations (Sonnet solo, Sonnet + Opus advisor, Opus solo) in parallel with live streaming, then displays a full cost/quality/latency comparison dashboard.

**Architecture:** Single Next.js 15 App Router app. Three API routes stream SSE from the Anthropic API. A shared `lib/` layer handles agent logic, pricing math, and quality scoring. Six UI components render the comparison grid, metrics, and summary bar.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Geist fonts, Anthropic SDK (`@anthropic-ai/sdk`), Lucide React

---

## File Map

| File | Responsibility |
|------|----------------|
| `app/layout.tsx` | Root layout, Geist fonts, canvas bg |
| `app/globals.css` | Tailwind base + CSS custom properties |
| `app/page.tsx` | Page shell — composes all components |
| `app/api/research/baseline/route.ts` | SSE route: Sonnet solo agent |
| `app/api/research/advisor/route.ts` | SSE route: Sonnet + Opus advisor agent |
| `app/api/research/opus/route.ts` | SSE route: Opus solo agent |
| `app/api/judge/route.ts` | POST route: quality scoring |
| `lib/agents/shared.ts` | System prompt, tool definitions, SSE helpers |
| `lib/agents/baseline-agent.ts` | Sonnet-only agent runner |
| `lib/agents/advisor-agent.ts` | Sonnet executor + Opus advisor runner |
| `lib/agents/opus-agent.ts` | Opus solo agent runner |
| `lib/metrics.ts` | Pricing constants, cost calculation, MetricsSnapshot type |
| `lib/quality.ts` | Judge model call, QualityScore type |
| `lib/types.ts` | All shared TypeScript types (SSEEvent, FinalMetrics, etc.) |
| `components/ResearchForm.tsx` | Query input + Run button |
| `components/ComparisonGrid.tsx` | Three-column layout |
| `components/AgentColumn.tsx` | Single column: label + stream + metrics |
| `components/MetricsCard.tsx` | Token/cost/latency display |
| `components/QualityChart.tsx` | 4-dimension bar chart (no charting lib — pure divs) |
| `components/SummaryBar.tsx` | Auto-generated summary stat |
| `tailwind.config.ts` | Anti-AI design system |
| `.env.local` | ANTHROPIC_API_KEY |
| `.env.example` | Placeholder for GitHub |
| `README.md` | Setup instructions + what the metrics mean |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.env.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/andreipop/Projects
npx create-next-app@latest advisor-strategy \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbopack
cd advisor-strategy
```

Expected: project created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk lucide-react geist
```

Expected: packages added to `node_modules`, no peer dep errors.

- [ ] **Step 3: Replace `tailwind.config.ts` with Anti-AI design system**

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        canvas: "#0A0A0A",
        surface: {
          DEFAULT: "#121212",
          hover: "#171717",
          active: "#1E1E1E",
        },
        content: {
          DEFAULT: "#FAFAFA",
          muted: "#A1A1AA",
        },
        divider: "rgba(255, 255, 255, 0.1)",
        accent: {
          primary: "#06B6D4",
        },
      },
      boxShadow: {
        stamped:
          "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 0 rgba(255,255,255,0.1)",
        "stamped-hover":
          "inset 0 0 0 1px rgba(255,255,255,0.15), inset 0 1px 0 0 rgba(255,255,255,0.2)",
      },
      transitionTimingFunction: {
        snappy: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        "250": "250ms",
      },
      animation: {
        "fade-up": "fadeUp 300ms cubic-bezier(0.16,1,0.3,1) forwards",
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      maxWidth: {
        reading: "65ch",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html {
  color-scheme: dark;
}

body {
  background-color: #0A0A0A;
  color: #FAFAFA;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
```

- [ ] **Step 5: Replace `app/layout.tsx`**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Advisor Strategy — Claude Cost/Quality Demo",
  description:
    "Compare Sonnet solo, Sonnet + Opus advisor, and Opus solo on any research query. Real token costs and quality scores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body className="bg-canvas text-content min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create `.env.example` and `.env.local`**

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Create `.env.local` with your actual key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 7: Update `.gitignore` to exclude `.env.local`**

Verify `.gitignore` already contains `.env.local` (create-next-app adds it). If not, add it.

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Anti-AI design system"
```

---

## Task 2: Shared types and metrics library

**Files:**
- Create: `lib/types.ts`
- Create: `lib/metrics.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```typescript
// lib/types.ts

export type AgentVariant = "baseline" | "advisor" | "opus";

export interface MetricsSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  advisorTokens: number; // 0 for non-advisor variants
  advisorCalls: number;  // 0 for non-advisor variants
  toolCalls: number;
  elapsedMs: number;
  estimatedCostUsd: number;
}

export interface FinalMetrics extends MetricsSnapshot {
  tokensPerSecond: number;
}

export interface QualityScore {
  sourceDepth: number;     // 1-10
  reasoning: number;       // 1-10
  completeness: number;    // 1-10
  accuracy: number;        // 1-10
  overall: number;         // average of the four
}

export interface RunResult {
  variant: AgentVariant;
  output: string;
  metrics: FinalMetrics;
  quality: QualityScore | null; // null until judge completes
}

// SSE event types sent from API routes to the client
export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "advisor_call"; callNumber: number }
  | { type: "tool_call"; name: string }
  | { type: "metrics"; data: MetricsSnapshot }
  | { type: "done"; finalMetrics: FinalMetrics }
  | { type: "error"; message: string };

// Judge API request/response
export interface JudgeRequest {
  baselineOutput: string;
  advisorOutput: string;
  opusOutput: string;
  query: string;
}

export interface JudgeResponse {
  baseline: QualityScore;
  advisor: QualityScore;
  opus: QualityScore;
}
```

- [ ] **Step 2: Create `lib/metrics.ts`**

```typescript
// lib/metrics.ts
import type { MetricsSnapshot, FinalMetrics } from "./types";

// Anthropic pricing as of 2026-04 (per million tokens)
// Update these constants if pricing changes
export const PRICING = {
  sonnet: {
    inputPerMToken: 3.0,
    outputPerMToken: 15.0,
    cacheReadPerMToken: 0.30,
  },
  opus: {
    inputPerMToken: 15.0,
    outputPerMToken: 75.0,
    cacheReadPerMToken: 1.50,
  },
} as const;

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  advisorTokens: number,
  model: "sonnet" | "opus"
): number {
  const p = PRICING[model];
  const executorCost =
    (inputTokens / 1_000_000) * p.inputPerMToken +
    (outputTokens / 1_000_000) * p.outputPerMToken +
    (cacheReadTokens / 1_000_000) * p.cacheReadPerMToken;

  // Advisor tokens are always billed at Opus rates
  const advisorCost =
    (advisorTokens / 1_000_000) * PRICING.opus.inputPerMToken;

  return executorCost + advisorCost;
}

export function toFinalMetrics(
  snapshot: MetricsSnapshot,
  startTimeMs: number
): FinalMetrics {
  const elapsedMs = Date.now() - startTimeMs;
  const totalTokens = snapshot.inputTokens + snapshot.outputTokens;
  const tokensPerSecond =
    elapsedMs > 0 ? Math.round((totalTokens / elapsedMs) * 1000) : 0;
  return { ...snapshot, elapsedMs, tokensPerSecond };
}

export function emptyMetrics(): MetricsSnapshot {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    advisorTokens: 0,
    advisorCalls: 0,
    toolCalls: 0,
    elapsedMs: 0,
    estimatedCostUsd: 0,
  };
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}m`;
  return `$${usd.toFixed(4)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/metrics.ts
git commit -m "feat: add shared types and metrics library"
```

---

## Task 3: Shared agent utilities

**Files:**
- Create: `lib/agents/shared.ts`

- [ ] **Step 1: Create `lib/agents/shared.ts`**

```typescript
// lib/agents/shared.ts
import type { SSEEvent } from "../types";

export const RESEARCH_SYSTEM_PROMPT = `You are a rigorous research assistant. When given a research query:

1. Search for 3-5 authoritative sources using the web_search tool
2. Fetch the full content of the most relevant pages using the web_fetch tool
3. Synthesize your findings into a structured research report with:
   - Executive summary (2-3 sentences)
   - Key findings (bullet points with sources cited inline)
   - Tradeoffs and caveats
   - Recommended next steps or conclusions

Be thorough, cite your sources, and surface genuine tradeoffs. Do not pad or repeat yourself.`;

export const AGENT_TOOLS = [
  {
    name: "web_search",
    description: "Search the web for information on a topic",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description: "Fetch the content of a web page",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
] as const;

// Encode an SSEEvent as a Server-Sent Events string
export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// Create a ReadableStream that sends SSE events
export function createSSEStream(
  fn: (send: (event: SSEEvent) => void, close: () => void) => Promise<void>
): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };
      const close = () => controller.close();
      try {
        await fn(send, close);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}

// Minimal Brave Search implementation via fetch
// Falls back to returning a placeholder if BRAVE_API_KEY is not set
export async function executeWebSearch(query: string): Promise<string> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    return `[Search results for "${query}" — set BRAVE_API_KEY for live results]`;
  }
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    { headers: { "X-Subscription-Token": key, Accept: "application/json" } }
  );
  if (!res.ok) return `[Search failed: ${res.status}]`;
  const data = await res.json();
  const results = (data.web?.results ?? []).slice(0, 5);
  return results
    .map((r: { title: string; url: string; description: string }) =>
      `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}`
    )
    .join("\n\n");
}

export async function executeWebFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    // Strip HTML tags and truncate to 4000 chars
    const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return clean.slice(0, 4000);
  } catch {
    return `[Failed to fetch ${url}]`;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/shared.ts
git commit -m "feat: add shared agent utilities and SSE helpers"
```

---

## Task 4: Baseline agent

**Files:**
- Create: `lib/agents/baseline-agent.ts`

- [ ] **Step 1: Create `lib/agents/baseline-agent.ts`**

```typescript
// lib/agents/baseline-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  RESEARCH_SYSTEM_PROMPT,
  AGENT_TOOLS,
  executeWebSearch,
  executeWebFetch,
} from "./shared";
import { calculateCost, emptyMetrics } from "../metrics";
import type { SSEEvent, FinalMetrics, MetricsSnapshot } from "../types";

const client = new Anthropic();

export async function runBaselineAgent(
  query: string,
  send: (event: SSEEvent) => void
): Promise<FinalMetrics> {
  const startTime = Date.now();
  const metrics: MetricsSnapshot = emptyMetrics();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: query },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: RESEARCH_SYSTEM_PROMPT,
      tools: AGENT_TOOLS as Anthropic.Tool[],
      messages,
      stream: true,
    });

    let assistantText = "";
    let toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    let stopReason: string | null = null;

    for await (const event of response) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        assistantText += event.delta.text;
        send({ type: "token", content: event.delta.text });
      }

      if (event.type === "content_block_start" &&
          event.content_block.type === "tool_use") {
        metrics.toolCalls++;
        send({ type: "tool_call", name: event.content_block.name });
      }

      if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason ?? null;
      }

      if (event.type === "message_start" && event.message.usage) {
        metrics.inputTokens += event.message.usage.input_tokens;
      }

      if (event.type === "message_delta" && event.usage) {
        metrics.outputTokens += event.usage.output_tokens;
      }
    }

    // Rebuild final message from streaming for tool use detection
    const finalMessage = await response.finalMessage();
    toolUseBlocks = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    metrics.estimatedCostUsd = calculateCost(
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens,
      0,
      "sonnet"
    );
    send({ type: "metrics", data: { ...metrics } });

    if (stopReason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    // Execute tool calls
    messages.push({ role: "assistant", content: finalMessage.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolBlock of toolUseBlocks) {
      let result = "";
      if (toolBlock.name === "web_search") {
        const input = toolBlock.input as { query: string };
        result = await executeWebSearch(input.query);
      } else if (toolBlock.name === "web_fetch") {
        const input = toolBlock.input as { url: string };
        result = await executeWebFetch(input.url);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  const elapsedMs = Date.now() - startTime;
  const totalTokens = metrics.inputTokens + metrics.outputTokens;
  const tokensPerSecond =
    elapsedMs > 0 ? Math.round((totalTokens / elapsedMs) * 1000) : 0;

  const finalMetrics: FinalMetrics = {
    ...metrics,
    elapsedMs,
    tokensPerSecond,
  };

  send({ type: "done", finalMetrics });
  return finalMetrics;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/baseline-agent.ts
git commit -m "feat: add Sonnet baseline agent"
```

---

## Task 5: Opus agent

**Files:**
- Create: `lib/agents/opus-agent.ts`

- [ ] **Step 1: Create `lib/agents/opus-agent.ts`**

```typescript
// lib/agents/opus-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  RESEARCH_SYSTEM_PROMPT,
  AGENT_TOOLS,
  executeWebSearch,
  executeWebFetch,
} from "./shared";
import { calculateCost, emptyMetrics } from "../metrics";
import type { SSEEvent, FinalMetrics, MetricsSnapshot } from "../types";

const client = new Anthropic();

export async function runOpusAgent(
  query: string,
  send: (event: SSEEvent) => void
): Promise<FinalMetrics> {
  const startTime = Date.now();
  const metrics: MetricsSnapshot = emptyMetrics();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: query },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: RESEARCH_SYSTEM_PROMPT,
      tools: AGENT_TOOLS as Anthropic.Tool[],
      messages,
      stream: true,
    });

    let toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    let stopReason: string | null = null;

    for await (const event of response) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        send({ type: "token", content: event.delta.text });
      }

      if (event.type === "content_block_start" &&
          event.content_block.type === "tool_use") {
        metrics.toolCalls++;
        send({ type: "tool_call", name: event.content_block.name });
      }

      if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason ?? null;
      }

      if (event.type === "message_start" && event.message.usage) {
        metrics.inputTokens += event.message.usage.input_tokens;
      }

      if (event.type === "message_delta" && event.usage) {
        metrics.outputTokens += event.usage.output_tokens;
      }
    }

    const finalMessage = await response.finalMessage();
    toolUseBlocks = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    metrics.estimatedCostUsd = calculateCost(
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens,
      0,
      "opus"
    );
    send({ type: "metrics", data: { ...metrics } });

    if (stopReason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    messages.push({ role: "assistant", content: finalMessage.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolBlock of toolUseBlocks) {
      let result = "";
      if (toolBlock.name === "web_search") {
        const input = toolBlock.input as { query: string };
        result = await executeWebSearch(input.query);
      } else if (toolBlock.name === "web_fetch") {
        const input = toolBlock.input as { url: string };
        result = await executeWebFetch(input.url);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  const elapsedMs = Date.now() - startTime;
  const totalTokens = metrics.inputTokens + metrics.outputTokens;
  const tokensPerSecond =
    elapsedMs > 0 ? Math.round((totalTokens / elapsedMs) * 1000) : 0;

  const finalMetrics: FinalMetrics = { ...metrics, elapsedMs, tokensPerSecond };
  send({ type: "done", finalMetrics });
  return finalMetrics;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/opus-agent.ts
git commit -m "feat: add Opus gold-standard agent"
```

---

## Task 6: Advisor agent

**Files:**
- Create: `lib/agents/advisor-agent.ts`

- [ ] **Step 1: Create `lib/agents/advisor-agent.ts`**

```typescript
// lib/agents/advisor-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  RESEARCH_SYSTEM_PROMPT,
  AGENT_TOOLS,
  executeWebSearch,
  executeWebFetch,
} from "./shared";
import { calculateCost, emptyMetrics } from "../metrics";
import type { SSEEvent, FinalMetrics, MetricsSnapshot } from "../types";

// Use a plain fetch-based client so we can pass custom headers
// The SDK does not yet expose the advisor tool natively
async function callAnthropicWithAdvisor(
  body: object,
  apiKey: string
): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "advisor-tool-2026-03-01",
    },
    body: JSON.stringify(body),
  });
}

export async function runAdvisorAgent(
  query: string,
  send: (event: SSEEvent) => void
): Promise<FinalMetrics> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const startTime = Date.now();
  const metrics: MetricsSnapshot = emptyMetrics();
  let advisorCallCount = 0;

  const messages: Array<{ role: string; content: unknown }> = [
    { role: "user", content: query },
  ];

  while (true) {
    const requestBody = {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: RESEARCH_SYSTEM_PROMPT,
      tools: [
        ...AGENT_TOOLS,
        {
          type: "advisor_20260301",
          name: "advisor",
          advisor_model: "claude-opus-4-6",
          max_uses: 5,
        },
      ],
      messages,
      stream: true,
    };

    const response = await callAnthropicWithAdvisor(requestBody, apiKey);

    if (!response.ok || !response.body) {
      const errText = await response.text();
      send({ type: "error", message: `Advisor API error: ${errText}` });
      break;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stopReason: string | null = null;
    const contentBlocks: Record<number, { type: string; name?: string; id?: string; input?: string; advisorTokens?: number }> = {};
    let advisorTokensThisTurn = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        if (event.type === "message_start") {
          const usage = (event.message as { usage?: { input_tokens?: number } })?.usage;
          if (usage?.input_tokens) metrics.inputTokens += usage.input_tokens;
        }

        if (event.type === "content_block_start") {
          const idx = event.index as number;
          const block = event.content_block as { type: string; name?: string; id?: string };
          contentBlocks[idx] = { type: block.type, name: block.name, id: block.id, input: "" };

          if (block.type === "tool_use" && block.name !== "advisor") {
            metrics.toolCalls++;
            send({ type: "tool_call", name: block.name ?? "unknown" });
          }
          if (block.type === "tool_use" && block.name === "advisor") {
            advisorCallCount++;
            metrics.advisorCalls = advisorCallCount;
            send({ type: "advisor_call", callNumber: advisorCallCount });
          }
        }

        if (event.type === "content_block_delta") {
          const idx = event.index as number;
          const delta = event.delta as { type: string; text?: string; partial_json?: string };
          if (delta.type === "text_delta" && delta.text) {
            send({ type: "token", content: delta.text });
          }
          if (delta.type === "input_json_delta" && contentBlocks[idx]) {
            contentBlocks[idx].input = (contentBlocks[idx].input ?? "") + (delta.partial_json ?? "");
          }
          // Advisor usage delta — the API reports advisor tokens inline
          if ((delta as Record<string, unknown>).type === "advisor_usage_delta") {
            advisorTokensThisTurn += ((delta as Record<string, unknown>).advisor_tokens as number) ?? 0;
          }
        }

        if (event.type === "message_delta") {
          const delta = event.delta as { stop_reason?: string };
          stopReason = delta.stop_reason ?? null;
          const usage = (event as { usage?: { output_tokens?: number } }).usage;
          if (usage?.output_tokens) metrics.outputTokens += usage.output_tokens;
        }
      }
    }

    metrics.advisorTokens += advisorTokensThisTurn;
    metrics.estimatedCostUsd = calculateCost(
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens,
      metrics.advisorTokens,
      "sonnet"
    );
    send({ type: "metrics", data: { ...metrics } });

    // Collect tool use blocks from this turn
    const toolBlocks = Object.values(contentBlocks).filter(
      (b) => b.type === "tool_use" && b.name !== "advisor"
    );

    if (stopReason === "end_turn" || toolBlocks.length === 0) {
      break;
    }

    // Rebuild assistant message for next turn
    const assistantContent: Array<{ type: string; id?: string; name?: string; input?: unknown }> = [];
    for (const [, block] of Object.entries(contentBlocks)) {
      if (block.type === "tool_use") {
        let parsedInput: unknown = {};
        try { parsedInput = JSON.parse(block.input ?? "{}"); } catch { /* ok */ }
        assistantContent.push({ type: "tool_use", id: block.id, name: block.name, input: parsedInput });
      }
    }
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
    for (const block of toolBlocks) {
      let result = "";
      const input = (() => {
        try { return JSON.parse(block.input ?? "{}"); } catch { return {}; }
      })();
      if (block.name === "web_search") result = await executeWebSearch(input.query ?? "");
      if (block.name === "web_fetch") result = await executeWebFetch(input.url ?? "");
      toolResults.push({ type: "tool_result", tool_use_id: block.id!, content: result });
    }
    messages.push({ role: "user", content: toolResults });
  }

  const elapsedMs = Date.now() - startTime;
  const totalTokens = metrics.inputTokens + metrics.outputTokens;
  const tokensPerSecond = elapsedMs > 0 ? Math.round((totalTokens / elapsedMs) * 1000) : 0;
  const finalMetrics: FinalMetrics = { ...metrics, elapsedMs, tokensPerSecond };
  send({ type: "done", finalMetrics });
  return finalMetrics;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/advisor-agent.ts
git commit -m "feat: add Sonnet + Opus advisor agent"
```

---

## Task 7: Quality judge

**Files:**
- Create: `lib/quality.ts`

- [ ] **Step 1: Create `lib/quality.ts`**

```typescript
// lib/quality.ts
import Anthropic from "@anthropic-ai/sdk";
import type { QualityScore, JudgeRequest, JudgeResponse } from "./types";

const client = new Anthropic();

const JUDGE_SYSTEM = `You are an expert research quality evaluator. You will be given a research query and three research reports (Baseline, Advisor, Opus). Score each report on four dimensions from 1-10:

1. sourceDepth: Number and quality of sources cited. 10 = multiple authoritative sources with direct quotes. 1 = no sources.
2. reasoning: Logical structure, handling of tradeoffs, and analytical depth. 10 = expert-level synthesis. 1 = superficial.
3. completeness: Coverage of all relevant angles of the query. 10 = comprehensive, nothing missing. 1 = narrow and incomplete.
4. accuracy: Internal consistency and confidence that claims are well-supported. 10 = fully grounded. 1 = unverifiable claims.

Respond ONLY with valid JSON matching this exact schema:
{
  "baseline": { "sourceDepth": N, "reasoning": N, "completeness": N, "accuracy": N, "overall": N },
  "advisor": { "sourceDepth": N, "reasoning": N, "completeness": N, "accuracy": N, "overall": N },
  "opus": { "sourceDepth": N, "reasoning": N, "completeness": N, "accuracy": N, "overall": N }
}

overall = average of the four dimensions, rounded to one decimal place. Be calibrated and honest — do not give inflated scores.`;

export async function judgeOutputs(req: JudgeRequest): Promise<JudgeResponse> {
  const userMessage = `Research query: ${req.query}

---
BASELINE (Sonnet solo):
${req.baselineOutput}

---
ADVISOR (Sonnet + Opus advisor):
${req.advisorOutput}

---
OPUS (Opus solo):
${req.opusOutput}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Extract JSON from the response (handle markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Judge returned non-JSON response: ${text}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as JudgeResponse;

  // Ensure overall is computed correctly if missing
  const ensureOverall = (score: QualityScore): QualityScore => ({
    ...score,
    overall:
      score.overall ??
      parseFloat(
        (
          (score.sourceDepth + score.reasoning + score.completeness + score.accuracy) /
          4
        ).toFixed(1)
      ),
  });

  return {
    baseline: ensureOverall(parsed.baseline),
    advisor: ensureOverall(parsed.advisor),
    opus: ensureOverall(parsed.opus),
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/quality.ts
git commit -m "feat: add quality judge using Opus"
```

---

## Task 8: API routes

**Files:**
- Create: `app/api/research/baseline/route.ts`
- Create: `app/api/research/advisor/route.ts`
- Create: `app/api/research/opus/route.ts`
- Create: `app/api/judge/route.ts`

- [ ] **Step 1: Create `app/api/research/baseline/route.ts`**

```typescript
// app/api/research/baseline/route.ts
import { runBaselineAgent } from "@/lib/agents/baseline-agent";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string };

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };
      try {
        await runBaselineAgent(query, send as Parameters<typeof runBaselineAgent>[1]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create `app/api/research/advisor/route.ts`**

```typescript
// app/api/research/advisor/route.ts
import { runAdvisorAgent } from "@/lib/agents/advisor-agent";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string };

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };
      try {
        await runAdvisorAgent(query, send as Parameters<typeof runAdvisorAgent>[1]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Create `app/api/research/opus/route.ts`**

```typescript
// app/api/research/opus/route.ts
import { runOpusAgent } from "@/lib/agents/opus-agent";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string };

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };
      try {
        await runOpusAgent(query, send as Parameters<typeof runOpusAgent>[1]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 4: Create `app/api/judge/route.ts`**

```typescript
// app/api/judge/route.ts
import { judgeOutputs } from "@/lib/quality";
import type { JudgeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json() as JudgeRequest;

  if (!body.query || !body.baselineOutput || !body.advisorOutput || !body.opusOutput) {
    return Response.json({ error: "All fields required" }, { status: 400 });
  }

  try {
    const scores = await judgeOutputs(body);
    return Response.json(scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Judge failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/
git commit -m "feat: add SSE research API routes and judge endpoint"
```

---

## Task 9: UI components

**Files:**
- Create: `components/ResearchForm.tsx`
- Create: `components/ComparisonGrid.tsx`
- Create: `components/AgentColumn.tsx`
- Create: `components/MetricsCard.tsx`
- Create: `components/QualityChart.tsx`
- Create: `components/SummaryBar.tsx`

- [ ] **Step 1: Create `components/ResearchForm.tsx`**

```typescript
// components/ResearchForm.tsx
"use client";

import { ChevronRight, Loader2 } from "lucide-react";

interface ResearchFormProps {
  onSubmit: (query: string) => void;
  isRunning: boolean;
}

export function ResearchForm({ onSubmit, isRunning }: ResearchFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const query = (fd.get("query") as string).trim();
    if (query) onSubmit(query);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-4xl mx-auto">
      <input
        name="query"
        type="text"
        placeholder="Enter a research query, e.g. 'Compare top vector databases for production RAG systems'"
        disabled={isRunning}
        className="flex-1 bg-surface border border-divider rounded-md h-11 px-4 font-mono text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-accent-primary transition-colors duration-250 ease-snappy disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isRunning}
        className="group flex items-center gap-2 bg-content text-canvas rounded-md h-11 px-6 font-medium text-sm hover:bg-white transition-all duration-250 ease-snappy disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? (
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <>
            Run Comparison
            <ChevronRight
              size={16}
              strokeWidth={1.5}
              className="transition-transform duration-250 ease-snappy group-hover:translate-x-px"
            />
          </>
        )}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `components/MetricsCard.tsx`**

```typescript
// components/MetricsCard.tsx
import { formatCost, formatTokens } from "@/lib/metrics";
import type { FinalMetrics } from "@/lib/types";

interface MetricsCardProps {
  metrics: FinalMetrics | null;
  isAdvisor?: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-content-muted">{label}</span>
      <span className="text-content tabular-nums">{value}</span>
    </div>
  );
}

export function MetricsCard({ metrics, isAdvisor }: MetricsCardProps) {
  if (!metrics) {
    return (
      <div className="font-mono text-xs text-content-muted space-y-1.5 animate-pulse">
        <div className="h-3 bg-surface-active rounded w-3/4" />
        <div className="h-3 bg-surface-active rounded w-1/2" />
        <div className="h-3 bg-surface-active rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="font-mono text-xs space-y-1.5">
      <Row label="Cost" value={formatCost(metrics.estimatedCostUsd)} />
      <Row label="Input tokens" value={formatTokens(metrics.inputTokens)} />
      <Row label="Output tokens" value={formatTokens(metrics.outputTokens)} />
      {isAdvisor && (
        <Row label="Advisor tokens" value={formatTokens(metrics.advisorTokens)} />
      )}
      {isAdvisor && (
        <Row label="Advisor calls" value={String(metrics.advisorCalls)} />
      )}
      <Row label="Tool calls" value={String(metrics.toolCalls)} />
      <Row label="Latency" value={`${(metrics.elapsedMs / 1000).toFixed(1)}s`} />
      <Row label="Tokens/sec" value={String(metrics.tokensPerSecond)} />
    </div>
  );
}
```

- [ ] **Step 3: Create `components/QualityChart.tsx`**

```typescript
// components/QualityChart.tsx
import type { QualityScore } from "@/lib/types";

interface QualityChartProps {
  scores: {
    baseline: QualityScore | null;
    advisor: QualityScore | null;
    opus: QualityScore | null;
  };
}

const DIMENSIONS: { key: keyof Omit<QualityScore, "overall">; label: string }[] = [
  { key: "sourceDepth", label: "Source Depth" },
  { key: "reasoning", label: "Reasoning" },
  { key: "completeness", label: "Completeness" },
  { key: "accuracy", label: "Accuracy" },
];

const VARIANTS = [
  { key: "baseline" as const, label: "Sonnet", color: "bg-content-muted" },
  { key: "advisor" as const, label: "Advisor", color: "bg-accent-primary" },
  { key: "opus" as const, label: "Opus", color: "bg-content" },
];

export function QualityChart({ scores }: QualityChartProps) {
  const hasAny = scores.baseline || scores.advisor || scores.opus;

  if (!hasAny) {
    return (
      <div className="text-center text-content-muted font-mono text-xs py-6">
        Quality scores will appear after all runs complete
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 justify-center">
        {VARIANTS.map((v) => (
          <div key={v.key} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${v.color}`} />
            <span className="font-mono text-xs text-content-muted">{v.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {DIMENSIONS.map((dim) => (
          <div key={dim.key}>
            <div className="font-mono text-xs text-content-muted mb-1.5">{dim.label}</div>
            <div className="space-y-1">
              {VARIANTS.map((v) => {
                const score = scores[v.key];
                const value = score ? score[dim.key] : 0;
                return (
                  <div key={v.key} className="flex items-center gap-2">
                    <div className="w-16 font-mono text-xs text-content-muted text-right">
                      {score ? `${value}/10` : "—"}
                    </div>
                    <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-snappy ${v.color}`}
                        style={{ width: score ? `${value * 10}%` : "0%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/AgentColumn.tsx`**

```typescript
// components/AgentColumn.tsx
"use client";

import { useEffect, useRef } from "react";
import { MetricsCard } from "./MetricsCard";
import type { FinalMetrics, QualityScore } from "@/lib/types";

interface AgentColumnProps {
  title: string;
  subtitle: string;
  isSweet?: boolean;
  tokens: string[];
  advisorCalls: number[];
  toolCalls: string[];
  metrics: FinalMetrics | null;
  quality: QualityScore | null;
  isRunning: boolean;
}

export function AgentColumn({
  title,
  subtitle,
  isSweet,
  tokens,
  advisorCalls,
  toolCalls,
  metrics,
  quality,
  isRunning,
}: AgentColumnProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [tokens]);

  return (
    <div
      className={`flex flex-col bg-surface shadow-stamped rounded-lg overflow-hidden transition-all duration-250 ease-snappy ${
        isSweet
          ? "border border-accent-primary/30 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.15),inset_0_1px_0_0_rgba(6,182,212,0.1)]"
          : "border border-divider"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
        <div>
          <div className="font-mono text-xs text-content-muted tracking-wider uppercase">
            {title}
          </div>
          <div className="font-mono text-xs text-content-muted/60 mt-0.5">
            {subtitle}
          </div>
        </div>
        {isSweet && (
          <span className="font-mono text-xs text-accent-primary border border-accent-primary/30 rounded px-2 py-0.5">
            ★ SWEET SPOT
          </span>
        )}
      </div>

      {/* Output stream */}
      <div
        ref={outputRef}
        className="flex-1 min-h-[280px] max-h-[400px] overflow-y-auto p-4 bg-black/40 font-mono text-xs leading-relaxed text-content"
      >
        {tokens.length === 0 && !isRunning && (
          <span className="text-content-muted">Output will appear here...</span>
        )}
        {tokens.length === 0 && isRunning && (
          <span className="text-content-muted">
            <span className="inline-block w-1.5 h-3 bg-accent-primary animate-blink ml-0.5" />
          </span>
        )}
        {tokens.map((chunk, i) => (
          <span key={i}>{chunk}</span>
        ))}
        {isRunning && tokens.length > 0 && (
          <span className="inline-block w-1.5 h-3 bg-accent-primary animate-blink ml-0.5" />
        )}

        {/* Advisor call badges */}
        {advisorCalls.map((n) => (
          <div key={n} className="my-1">
            <span className="inline-block font-mono text-xs text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded px-2 py-0.5">
              ↑ advisor call #{n}
            </span>
          </div>
        ))}

        {/* Tool call badges */}
        {toolCalls.map((name, i) => (
          <div key={i} className="my-1">
            <span className="inline-block font-mono text-xs text-content-muted bg-surface border border-divider rounded px-2 py-0.5">
              ⚙ {name}
            </span>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="p-4 border-t border-divider space-y-3">
        <MetricsCard metrics={metrics} isAdvisor={isSweet} />
        {quality && (
          <div className="pt-2 border-t border-divider">
            <div className="font-mono text-xs text-content-muted mb-1">
              Quality score
            </div>
            <div className="font-mono text-2xl font-medium tracking-tight text-content">
              {quality.overall}
              <span className="text-xs text-content-muted">/10</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/ComparisonGrid.tsx`**

```typescript
// components/ComparisonGrid.tsx
import { AgentColumn } from "./AgentColumn";
import type { FinalMetrics, QualityScore } from "@/lib/types";

interface ColumnState {
  tokens: string[];
  advisorCalls: number[];
  toolCalls: string[];
  metrics: FinalMetrics | null;
  quality: QualityScore | null;
  isRunning: boolean;
}

interface ComparisonGridProps {
  baseline: ColumnState;
  advisor: ColumnState;
  opus: ColumnState;
}

export function ComparisonGrid({ baseline, advisor, opus }: ComparisonGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <AgentColumn
        title="SONNET SOLO"
        subtitle="claude-sonnet-4-6 · Baseline"
        {...baseline}
      />
      <AgentColumn
        title="SONNET + ADVISOR"
        subtitle="claude-sonnet-4-6 + opus advisor"
        isSweet
        {...advisor}
      />
      <AgentColumn
        title="OPUS SOLO"
        subtitle="claude-opus-4-6 · Gold Standard"
        {...opus}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create `components/SummaryBar.tsx`**

```typescript
// components/SummaryBar.tsx
import type { FinalMetrics, QualityScore } from "@/lib/types";
import { formatCost } from "@/lib/metrics";

interface SummaryBarProps {
  baselineMetrics: FinalMetrics | null;
  advisorMetrics: FinalMetrics | null;
  opusMetrics: FinalMetrics | null;
  advisorQuality: QualityScore | null;
  opusQuality: QualityScore | null;
}

export function SummaryBar({
  baselineMetrics,
  advisorMetrics,
  opusMetrics,
  advisorQuality,
  opusQuality,
}: SummaryBarProps) {
  const isComplete =
    baselineMetrics && advisorMetrics && opusMetrics && advisorQuality && opusQuality;

  if (!isComplete) return null;

  const qualityPct =
    opusQuality.overall > 0
      ? Math.round((advisorQuality.overall / opusQuality.overall) * 100)
      : 0;

  const costPct =
    opusMetrics.estimatedCostUsd > 0
      ? Math.round(
          (advisorMetrics.estimatedCostUsd / opusMetrics.estimatedCostUsd) * 100
        )
      : 0;

  const advisorCalls = advisorMetrics.advisorCalls;

  return (
    <div className="bg-surface border-t border-divider px-6 py-5 animate-fade-up">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-content-muted uppercase tracking-wider mb-1">
            Summary
          </div>
          <p className="font-mono text-sm text-content-muted">
            Advisor strategy achieved{" "}
            <span className="text-accent-primary font-medium">{qualityPct}%</span>{" "}
            of Opus quality at{" "}
            <span className="text-accent-primary font-medium">{costPct}%</span>{" "}
            of the cost.{" "}
            <span className="text-content-muted">
              {advisorCalls} advisor call{advisorCalls !== 1 ? "s" : ""} made.
            </span>
          </p>
        </div>
        <div className="flex gap-6 font-mono text-xs">
          <div>
            <div className="text-content-muted mb-0.5">Baseline</div>
            <div className="text-content tabular-nums">
              {formatCost(baselineMetrics.estimatedCostUsd)}
            </div>
          </div>
          <div>
            <div className="text-accent-primary mb-0.5">Advisor</div>
            <div className="text-content tabular-nums">
              {formatCost(advisorMetrics.estimatedCostUsd)}
            </div>
          </div>
          <div>
            <div className="text-content-muted mb-0.5">Opus</div>
            <div className="text-content tabular-nums">
              {formatCost(opusMetrics.estimatedCostUsd)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/
git commit -m "feat: add UI components — columns, metrics, quality chart, summary bar"
```

---

## Task 10: Main page and state management

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```typescript
// app/page.tsx
"use client";

import { useState, useCallback } from "react";
import { ResearchForm } from "@/components/ResearchForm";
import { ComparisonGrid } from "@/components/ComparisonGrid";
import { QualityChart } from "@/components/QualityChart";
import { SummaryBar } from "@/components/SummaryBar";
import type {
  FinalMetrics,
  QualityScore,
  SSEEvent,
  JudgeResponse,
} from "@/lib/types";

interface ColumnState {
  tokens: string[];
  advisorCalls: number[];
  toolCalls: string[];
  metrics: FinalMetrics | null;
  quality: QualityScore | null;
  isRunning: boolean;
  output: string; // accumulated full text for judge
}

const emptyColumn = (): ColumnState => ({
  tokens: [],
  advisorCalls: [],
  toolCalls: [],
  metrics: null,
  quality: null,
  isRunning: false,
  output: "",
});

type Variant = "baseline" | "advisor" | "opus";

export default function Home() {
  const [baseline, setBaseline] = useState<ColumnState>(emptyColumn());
  const [advisor, setAdvisor] = useState<ColumnState>(emptyColumn());
  const [opus, setOpus] = useState<ColumnState>(emptyColumn());
  const [isRunning, setIsRunning] = useState(false);

  const setColumn = useCallback(
    (variant: Variant, updater: (prev: ColumnState) => ColumnState) => {
      if (variant === "baseline") setBaseline(updater);
      else if (variant === "advisor") setAdvisor(updater);
      else setOpus(updater);
    },
    []
  );

  async function streamVariant(
    variant: Variant,
    query: string
  ): Promise<string> {
    setColumn(variant, (prev) => ({ ...prev, isRunning: true }));

    const res = await fetch(`/api/research/${variant}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.body) {
      setColumn(variant, (prev) => ({ ...prev, isRunning: false }));
      return "";
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullOutput = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();

        let event: SSEEvent;
        try {
          event = JSON.parse(data) as SSEEvent;
        } catch {
          continue;
        }

        if (event.type === "token") {
          fullOutput += event.content;
          setColumn(variant, (prev) => ({
            ...prev,
            tokens: [...prev.tokens, event.content],
            output: prev.output + event.content,
          }));
        } else if (event.type === "advisor_call") {
          setColumn(variant, (prev) => ({
            ...prev,
            advisorCalls: [...prev.advisorCalls, event.callNumber],
          }));
        } else if (event.type === "tool_call") {
          setColumn(variant, (prev) => ({
            ...prev,
            toolCalls: [...prev.toolCalls, event.name],
          }));
        } else if (event.type === "done") {
          setColumn(variant, (prev) => ({
            ...prev,
            metrics: event.finalMetrics,
            isRunning: false,
          }));
        } else if (event.type === "error") {
          console.error(`[${variant}] error:`, event.message);
          setColumn(variant, (prev) => ({ ...prev, isRunning: false }));
        }
      }
    }

    setColumn(variant, (prev) => ({ ...prev, isRunning: false }));
    return fullOutput;
  }

  const handleSubmit = useCallback(
    async (query: string) => {
      setIsRunning(true);
      setBaseline(emptyColumn());
      setAdvisor(emptyColumn());
      setOpus(emptyColumn());

      // Run all three in parallel
      const [baselineOut, advisorOut, opusOut] = await Promise.all([
        streamVariant("baseline", query),
        streamVariant("advisor", query),
        streamVariant("opus", query),
      ]);

      // Run quality judge
      try {
        const judgeRes = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            baselineOutput: baselineOut,
            advisorOutput: advisorOut,
            opusOutput: opusOut,
          }),
        });
        if (judgeRes.ok) {
          const scores = (await judgeRes.json()) as JudgeResponse;
          setBaseline((prev) => ({ ...prev, quality: scores.baseline }));
          setAdvisor((prev) => ({ ...prev, quality: scores.advisor }));
          setOpus((prev) => ({ ...prev, quality: scores.opus }));
        }
      } catch (err) {
        console.error("Judge failed:", err);
      }

      setIsRunning(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-divider px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-mono text-lg font-medium tracking-tight text-content">
            advisor-strategy
          </h1>
          <p className="font-mono text-xs text-content-muted mt-1">
            Sonnet solo · Sonnet + Opus advisor · Opus solo — cost &amp; quality comparison
          </p>
        </div>
      </header>

      {/* Query input */}
      <div className="border-b border-divider px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <ResearchForm onSubmit={handleSubmit} isRunning={isRunning} />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <ComparisonGrid
            baseline={baseline}
            advisor={advisor}
            opus={opus}
          />

          {/* Quality chart */}
          <div className="bg-surface border border-divider shadow-stamped rounded-lg p-6">
            <h2 className="font-mono text-xs text-content-muted uppercase tracking-wider mb-6">
              Quality Breakdown
            </h2>
            <QualityChart
              scores={{
                baseline: baseline.quality,
                advisor: advisor.quality,
                opus: opus.quality,
              }}
            />
          </div>
        </div>
      </main>

      {/* Summary bar */}
      <SummaryBar
        baselineMetrics={baseline.metrics}
        advisorMetrics={advisor.metrics}
        opusMetrics={opus.metrics}
        advisorQuality={advisor.quality}
        opusQuality={opus.quality}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify page loads**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: page renders with header, query input, three empty columns, and quality chart placeholder.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add main page with parallel streaming state management"
```

---

## Task 11: README and GitHub setup

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Advisor Strategy Demo

A live comparison of three Claude configurations on any research query:

| Variant | Model | Cost |
|---------|-------|------|
| Sonnet solo | claude-sonnet-4-6 | $ |
| Sonnet + Opus advisor | claude-sonnet-4-6 + claude-opus-4-6 advisor | $$ |
| Opus solo | claude-opus-4-6 | $$$ |

The advisor strategy pairs a cost-effective executor model with a frontier advisor that provides guidance on complex decisions without calling tools or producing output directly. This demo lets you see the cost/quality tradeoff empirically, in real time.

## What the metrics mean

- **Cost** — estimated cost using current Anthropic pricing
- **Advisor calls** — how many times the executor escalated to the Opus advisor
- **Quality score** — rated 1–10 by a separate Opus judge on: source depth, reasoning, completeness, accuracy
- **Quality %** — advisor score as a percentage of Opus score (the ceiling)

## Setup

```bash
git clone https://github.com/popand/advisor-strategy
cd advisor-strategy
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
# Optionally add BRAVE_API_KEY for live web search
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Web search falls back to a placeholder if `BRAVE_API_KEY` is not set. The agents still run and produce output using their training knowledge.
- The advisor feature requires beta access: `anthropic-beta: advisor-tool-2026-03-01`
- All three agents run in parallel — expect the full comparison to take 30–90 seconds

## References

- [The Advisor Strategy — Anthropic Blog](https://claude.com/blog/the-advisor-strategy)
- [Anthropic API Docs](https://docs.anthropic.com)
```

- [ ] **Step 2: Create GitHub repo and push**

```bash
git add README.md .env.example
git commit -m "docs: add README and env example"

gh repo create popand/advisor-strategy --public --source=. --remote=origin --push
```

Expected: repo created at `github.com/popand/advisor-strategy`, all commits pushed.

---

## Task 12: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Run a test query**

Open `http://localhost:3000`. Enter:
```
What are the tradeoffs between Pinecone, Weaviate, and Qdrant for a production RAG system?
```

Click "Run Comparison".

Expected:
- All three columns begin streaming simultaneously
- Advisor column shows `↑ advisor call #N` badges as they fire
- Tool call badges appear in all columns
- Metrics update live as tokens arrive
- After completion, quality scores appear in each column
- Quality chart fills in
- Summary bar appears with `X% of Opus quality at Y% of the cost`

- [ ] **Step 3: Verify no console errors**

Open browser devtools. Expected: no uncaught errors, no failed network requests (non-200s).

- [ ] **Step 4: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: TypeScript passes, Next.js build succeeds.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verified end-to-end smoke test passes"
git push
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Three-way comparison (Sonnet, Advisor, Opus) | Tasks 4, 5, 6, 8 |
| Parametric research query | Tasks 9 (ResearchForm), 10 (page.tsx) |
| Streaming SSE | Tasks 3, 8, 10 |
| Advisor call badges in stream | Tasks 6, 9 (AgentColumn) |
| All metrics (tokens, cost, latency, advisor calls, tool calls, tokens/sec) | Tasks 2, 9 (MetricsCard) |
| Quality judge (4 dimensions) | Task 7, 8 (judge route) |
| Quality chart | Task 9 (QualityChart) |
| Summary bar with derived metrics | Task 9 (SummaryBar) |
| Anti-AI design system | Task 1 (tailwind.config.ts, globals.css, layout.tsx) |
| Advisor column highlighted as sweet spot | Task 9 (AgentColumn isSweet) |
| README + GitHub | Task 11 |
| .env.example | Tasks 1, 11 |

All spec requirements covered. No gaps found.
