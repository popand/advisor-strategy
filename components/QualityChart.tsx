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
