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
