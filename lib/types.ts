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
