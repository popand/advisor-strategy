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
