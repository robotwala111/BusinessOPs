import { NextResponse } from "next/server";
import { generateCopilotAnswer } from "@/services/copilotProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== "string") {
      return NextResponse.json({ error: "A 'message' string is required in the request payload." }, { status: 400 });
    }

    const question = body.message.trim();
    const convId = body.conversation_id || body.conversationId || `conv-${Date.now()}`;
    const language = body.language || "auto";

    // If local/demo or AI_COPILOT_ENABLED is false, return structured fallback response
    if (process.env.AI_COPILOT_ENABLED !== "true") {
      return NextResponse.json({
        reply: "Hello! Welcome to Amiro Intelligence. How can I help you today?",
        conversation_id: convId,
        language,
        fallback: true
      });
    }

    const facts = body.facts || {};
    const history = Array.isArray(body.history) ? body.history : [];

    const result = await generateCopilotAnswer(question, facts, history);

    return NextResponse.json({
      reply: result.answer,
      conversation_id: convId,
      language,
      model: result.model,
      usage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    return NextResponse.json({
      reply: "I am having trouble connecting to the AI model right now. Please try again shortly.",
      conversation_id: "error",
      error: message,
      fallback: true
    }, { status: 200 });
  }
}

