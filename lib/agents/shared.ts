import type { SSEEvent } from "../types";

export const RESEARCH_SYSTEM_PROMPT = `You are a rigorous research assistant. When given a research query:

1. Search for 3-5 authoritative sources using the web_search tool
2. Fetch the full content of the most relevant pages using the web_fetch tool
3. Synthesize your findings into a structured research report with:
   - Executive summary (2-3 sentences)
   - Key findings (bullet points with sources cited inline)
   - Tradeoffs and caveats
   - Recommended next steps or conclusions

Be thorough, cite your sources, and surface genuine tradeoffs. Do not pad or repeat yourself.`;

// Advisor-specific system prompt — extends the base with explicit escalation guidance
export const ADVISOR_SYSTEM_PROMPT = `You are a rigorous research assistant. When given a research query:

1. Use the advisor tool FIRST before searching — call it to get expert guidance on how to approach the research
2. Search for 3-5 authoritative sources using the web_search tool
3. Fetch the full content of the most relevant pages using the web_fetch tool
4. If you encounter conflicting information or complex architectural tradeoffs, call the advisor again to help synthesize
5. Synthesize your findings into a structured research report with:
   - Executive summary (2-3 sentences)
   - Key findings (bullet points with sources cited inline)
   - Tradeoffs and caveats
   - Recommended next steps or conclusions

The advisor is your expert consultant for complex decisions. Use it for:
- Planning your research approach
- Resolving conflicting evidence
- Evaluating architectural or strategic tradeoffs
- Ensuring your synthesis is rigorous and complete

Be thorough, cite your sources, and surface genuine tradeoffs. Do not pad or repeat yourself.`;

export const AGENT_TOOLS = [
  {
    name: "web_search",
    description: "Search the web for information on a topic",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description: "Fetch the content of a web page",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
] as const;

// Encode an SSEEvent as a Server-Sent Events string
export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// Create a ReadableStream that sends SSE events
export function createSSEStream(
  fn: (send: (event: SSEEvent) => void, close: () => void) => Promise<void>
): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };
      const close = () => controller.close();
      try {
        await fn(send, close);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}

// Minimal Brave Search implementation via fetch
// Falls back to returning a placeholder if BRAVE_API_KEY is not set
export async function executeWebSearch(query: string): Promise<string> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    return `[Search results for "${query}" — set BRAVE_API_KEY for live results]`;
  }
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    { headers: { "X-Subscription-Token": key, Accept: "application/json" } }
  );
  if (!res.ok) return `[Search failed: ${res.status}]`;
  const data = await res.json();
  const results = (data.web?.results ?? []).slice(0, 5);
  return results
    .map((r: { title: string; url: string; description: string }) =>
      `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}`
    )
    .join("\n\n");
}

export async function executeWebFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    // Strip HTML tags and truncate to 4000 chars
    const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return clean.slice(0, 4000);
  } catch {
    return `[Failed to fetch ${url}]`;
  }
}
