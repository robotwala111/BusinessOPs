import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

class SpeechError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

function responseError(error: unknown) {
  if (error instanceof SpeechError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  console.error("Speech-to-text error:", error instanceof Error ? error.message : "Unknown error");
  return jsonResponse(
    { error: error instanceof Error ? error.message : "Speech recognition failed" },
    500
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new SpeechError(
        "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
        503
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;
    const language = (formData.get("language") as string) || undefined;

    if (!audioFile) {
      throw new SpeechError("No audio file provided", 400);
    }

    // Check file size (max 25MB for Whisper API)
    if (audioFile.size > 25 * 1024 * 1024) {
      throw new SpeechError("Audio file too large. Maximum size is 25MB.", 413);
    }

    // Forward to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile, "audio.webm");
    whisperFormData.append("model", "whisper-1");
    
    // Only add language if specified (otherwise auto-detect)
    if (language && language !== "auto") {
      whisperFormData.append("language", language);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: whisperFormData,
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper API error:", response.status, errorText);
      throw new SpeechError(
        `Speech recognition service error: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as { text: string };
    
    if (!data.text || typeof data.text !== "string") {
      throw new SpeechError("Invalid response from speech recognition service", 502);
    }

    return jsonResponse({ transcript: data.text.trim() });

  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonResponse(
        { error: "Speech recognition timed out. Please try with a shorter audio clip." },
        408
      );
    }
    return responseError(error);
  }
}
