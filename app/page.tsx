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
