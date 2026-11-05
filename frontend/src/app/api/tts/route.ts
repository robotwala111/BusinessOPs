import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: unknown; language?: unknown };
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "Text is required for speech synthesis." }, { status: 400 });
    }
    if (body.text.length > 5000) {
      return NextResponse.json({ error: "Text is too long to read aloud." }, { status: 413 });
    }
    if (typeof body.language !== "string") {
      return NextResponse.json({ error: "A language is required for speech synthesis." }, { status: 400 });
    }

    const baseUrl = process.env.PIPER_BASE_URL?.trim();
    if (!baseUrl) {
      return NextResponse.json({ error: "Local Piper is not configured. Set PIPER_BASE_URL and start the speech service." }, { status: 503 });
    }

    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text.trim(), language: body.language }),
      signal: AbortSignal.timeout(55000),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
      const detail = typeof payload?.detail === "string" ? payload.detail : "Piper could not generate speech.";
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Local speech generation took too long. Try a shorter message." }, { status: 504 });
    }
    console.error("Local Piper TTS failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Local Piper is unavailable. Start the speech service and try again." }, { status: 503 });
  }
}
