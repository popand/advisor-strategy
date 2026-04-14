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
