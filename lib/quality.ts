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
