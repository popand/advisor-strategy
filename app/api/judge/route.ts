// app/api/judge/route.ts
import { judgeOutputs } from "@/lib/quality";
import type { JudgeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json() as JudgeRequest;

  if (!body.query || !body.baselineOutput || !body.advisorOutput || !body.opusOutput) {
    return Response.json({ error: "All fields required" }, { status: 400 });
  }

  try {
    const scores = await judgeOutputs(body);
    return Response.json(scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Judge failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
