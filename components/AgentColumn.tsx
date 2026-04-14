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
