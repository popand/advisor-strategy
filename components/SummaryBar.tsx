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
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
