# Advisor Strategy Demo

A live comparison of three Claude configurations on any research query:

| Variant | Model | Cost |
|---------|-------|------|
| Sonnet solo | claude-sonnet-4-6 | $ |
| Sonnet + Opus advisor | claude-sonnet-4-6 + claude-opus-4-6 advisor | $$ |
| Opus solo | claude-opus-4-6 | $$$ |

The advisor strategy pairs a cost-effective executor model with a frontier advisor that provides guidance on complex decisions without calling tools or producing output directly. This demo lets you see the cost/quality tradeoff empirically, in real time.

## What the metrics mean

- **Cost** — estimated cost using current Anthropic pricing
- **Advisor calls** — how many times the executor escalated to the Opus advisor
- **Quality score** — rated 1–10 by a separate Opus judge on: source depth, reasoning, completeness, accuracy
- **Quality %** — advisor score as a percentage of Opus score (the ceiling)

## Setup

```bash
git clone https://github.com/popand/advisor-strategy
cd advisor-strategy
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
# Optionally add BRAVE_API_KEY for live web search
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Web search falls back to a placeholder if `BRAVE_API_KEY` is not set. The agents still run and produce output using their training knowledge.
- The advisor feature requires beta access: `anthropic-beta: advisor-tool-2026-03-01`
- All three agents run in parallel — expect the full comparison to take 30–90 seconds

## References

- [The Advisor Strategy — Anthropic Blog](https://claude.com/blog/the-advisor-strategy)
- [Anthropic API Docs](https://docs.anthropic.com)
