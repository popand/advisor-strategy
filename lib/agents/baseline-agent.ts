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
    const response = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: RESEARCH_SYSTEM_PROMPT,
      tools: AGENT_TOOLS as unknown as Anthropic.Tool[],
      messages,
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
      (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use"
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
