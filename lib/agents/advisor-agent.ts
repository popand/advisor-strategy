import {
  ADVISOR_SYSTEM_PROMPT,
  AGENT_TOOLS,
  executeWebSearch,
  executeWebFetch,
} from "./shared";
import { calculateCost, emptyMetrics } from "../metrics";
import type { SSEEvent, FinalMetrics, MetricsSnapshot } from "../types";

// Use a plain fetch-based client so we can pass custom headers
// The SDK does not yet expose the advisor tool natively
async function callAnthropicWithAdvisor(
  body: object,
  apiKey: string
): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "advisor-tool-2026-03-01",
    },
    body: JSON.stringify(body),
  });
}

export async function runAdvisorAgent(
  query: string,
  send: (event: SSEEvent) => void
): Promise<FinalMetrics> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const startTime = Date.now();
  const metrics: MetricsSnapshot = emptyMetrics();
  let advisorCallCount = 0;

  const messages: Array<{ role: string; content: unknown }> = [
    { role: "user", content: query },
  ];

  while (true) {
    const requestBody = {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: ADVISOR_SYSTEM_PROMPT,
      tools: [
        ...AGENT_TOOLS,
        {
          type: "advisor_20260301",
          name: "advisor",
          model: "claude-opus-4-6",
          max_uses: 5,
        },
      ],
      messages,
      stream: true,
    };

    const response = await callAnthropicWithAdvisor(requestBody, apiKey);

    if (!response.ok || !response.body) {
      const errText = await response.text();
      send({ type: "error", message: `Advisor API error: ${errText}` });
      break;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stopReason: string | null = null;
    const contentBlocks: Record<number, { type: string; name?: string; id?: string; input?: string; advisorTokens?: number }> = {};
    let advisorInputThisTurn = 0;
    let advisorOutputThisTurn = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        if (event.type === "message_start") {
          const usage = (event.message as { usage?: { input_tokens?: number } })?.usage;
          if (usage?.input_tokens) metrics.inputTokens += usage.input_tokens;
        }

        if (event.type === "content_block_start") {
          const idx = event.index as number;
          const block = event.content_block as { type: string; name?: string; id?: string };
          contentBlocks[idx] = { type: block.type, name: block.name, id: block.id, input: "" };

          // Advisor fires as "server_tool_use" not "tool_use"
          if (block.type === "server_tool_use" && block.name === "advisor") {
            advisorCallCount++;
            metrics.advisorCalls = advisorCallCount;
            send({ type: "advisor_call", callNumber: advisorCallCount });
          }
          if (block.type === "tool_use" && block.name !== "advisor") {
            metrics.toolCalls++;
          }
        }

        if (event.type === "content_block_delta") {
          const idx = event.index as number;
          const delta = event.delta as { type: string; text?: string; partial_json?: string };
          if (delta.type === "text_delta" && delta.text) {
            send({ type: "token", content: delta.text });
            if (contentBlocks[idx]) {
              contentBlocks[idx].input = (contentBlocks[idx].input ?? "") + delta.text;
            }
          }
          if (delta.type === "input_json_delta" && contentBlocks[idx]) {
            contentBlocks[idx].input = (contentBlocks[idx].input ?? "") + (delta.partial_json ?? "");
          }
        }

        if (event.type === "message_delta") {
          const delta = event.delta as { stop_reason?: string };
          stopReason = delta.stop_reason ?? null;
          // Advisor tokens are in message_delta.usage.iterations as type="advisor_message"
          type Iteration = { type: string; input_tokens?: number; output_tokens?: number };
          const usage = (event as { usage?: { output_tokens?: number; iterations?: Iteration[] } }).usage;
          if (usage?.output_tokens) metrics.outputTokens += usage.output_tokens;
          if (usage?.iterations) {
            for (const iter of usage.iterations) {
              if (iter.type === "advisor_message") {
                advisorInputThisTurn += iter.input_tokens ?? 0;
                advisorOutputThisTurn += iter.output_tokens ?? 0;
              }
            }
          }
        }
      }
    }

    metrics.advisorInputTokens += advisorInputThisTurn;
    metrics.advisorOutputTokens += advisorOutputThisTurn;
    metrics.advisorTokens = metrics.advisorInputTokens + metrics.advisorOutputTokens;
    metrics.estimatedCostUsd = calculateCost(
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens,
      metrics.advisorInputTokens,
      metrics.advisorOutputTokens,
      "sonnet"
    );
    send({ type: "metrics", data: { ...metrics } });

    // Collect tool use blocks from this turn
    const toolBlocks = Object.values(contentBlocks).filter(
      (b) => b.type === "tool_use" && b.name !== "advisor"
    );

    // Only break on end_turn — toolBlocks can be empty when the advisor fired
    // without regular tool calls (e.g. advisor-only turn), which is valid
    if (stopReason === "end_turn") {
      break;
    }

    // If no tool blocks AND no advisor calls this turn, nothing to execute — break to avoid infinite loop
    const advisorBlocksThisTurn = Object.values(contentBlocks).filter(
      (b) => b.type === "server_tool_use" && b.name === "advisor"
    );
    if (toolBlocks.length === 0 && advisorBlocksThisTurn.length === 0) {
      break;
    }

    // Rebuild assistant message for next turn.
    // Include text and tool_use blocks only — server_tool_use/advisor_tool_result
    // are server-managed and must NOT be echoed back in messages.
    const assistantContent: Array<{ type: string; id?: string; name?: string; input?: unknown; text?: string }> = [];
    for (const [, block] of Object.entries(contentBlocks)) {
      if (block.type === "text") {
        assistantContent.push({ type: "text", text: block.input ?? "" }); // input field holds accumulated text
      } else if (block.type === "tool_use") {
        let parsedInput: unknown = {};
        try { parsedInput = JSON.parse(block.input ?? "{}"); } catch { /* ok */ }
        assistantContent.push({ type: "tool_use", id: block.id, name: block.name, input: parsedInput });
      }
    }
    if (assistantContent.length > 0) {
      messages.push({ role: "assistant", content: assistantContent });
    }

    const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
    for (const block of toolBlocks) {
      let result = "";
      const input = (() => {
        try { return JSON.parse(block.input ?? "{}"); } catch { return {}; }
      })();
      if (block.name === "web_search") {
        send({ type: "tool_call", name: "web_search", input: input.query ?? "" });
        result = await executeWebSearch(input.query ?? "");
      }
      if (block.name === "web_fetch") {
        send({ type: "tool_call", name: "web_fetch", input: input.url ?? "" });
        result = await executeWebFetch(input.url ?? "");
      }
      toolResults.push({ type: "tool_result", tool_use_id: block.id!, content: result });
    }
    messages.push({ role: "user", content: toolResults });
  }

  const elapsedMs = Date.now() - startTime;
  const totalTokens = metrics.inputTokens + metrics.outputTokens;
  const tokensPerSecond = elapsedMs > 0 ? Math.round((totalTokens / elapsedMs) * 1000) : 0;
  const finalMetrics: FinalMetrics = { ...metrics, elapsedMs, tokensPerSecond };
  send({ type: "done", finalMetrics });
  return finalMetrics;
}
