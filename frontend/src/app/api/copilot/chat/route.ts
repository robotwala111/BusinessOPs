import { NextResponse } from "next/server";
import { generateCopilotAnswer } from "@/services/copilotProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (process.env.AI_COPILOT_ENABLED !== "true") {
      return NextResponse.json({ fallback: true, reason: "AI_COPILOT_ENABLED is false" }, { status: 200 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== "string") {
      return NextResponse.json({ error: "A message string is required." }, { status: 400 });
    }

    const question = body.message.trim();
    const facts = body.facts || {};
    const history = Array.isArray(body.history) ? body.history : [];

    const result = await generateCopilotAnswer(question, facts, history);

    return NextResponse.json({
      answer: result.answer,
      model: result.model,
      usage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        estimated_cost_usd: null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    return NextResponse.json({ fallback: true, error: message }, { status: 200 });
  }
}

