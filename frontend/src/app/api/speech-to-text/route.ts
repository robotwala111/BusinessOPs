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
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;
    const audioFilename = audioFile instanceof File && audioFile.name ? audioFile.name : "audio.webm";
    const language = (formData.get("language") as string) || undefined;

    if (!audioFile) {
      throw new SpeechError("No audio file provided", 400);
    }
    if (audioFile.size === 0 || audioFile.size > 25 * 1024 * 1024) {
      throw new SpeechError("Audio file too large. Maximum size is 25MB.", 413);
    }

    const whisperBaseUrl = process.env.WHISPER_BASE_URL?.trim();
    if (!whisperBaseUrl) throw new SpeechError("Local Whisper is not configured. Set WHISPER_BASE_URL and start the service.", 503);
    const cleanUrl = whisperBaseUrl.replace(/\/+$/, "");
    const endpoint = cleanUrl.endsWith("/v1")
      ? `${cleanUrl}/audio/transcriptions`
      : `${cleanUrl}/v1/audio/transcriptions`;
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile, audioFilename);
    whisperFormData.append("model", "whisper-1");
    if (language && language !== "auto") whisperFormData.append("language", language);

    const response = await fetch(endpoint, {
      method: "POST",
      body: whisperFormData,
      signal: AbortSignal.timeout(120000),
      cache: "no-store"
    });

    if (!response.ok) {
      console.error("Local Whisper transcription failed", { status: response.status });
      throw new SpeechError(
        "Local Whisper could not transcribe this audio.",
        502
      );
    }

    const data = (await response.json()) as { text?: unknown };
    
    if (typeof data.text !== "string") {
      throw new SpeechError("Invalid response from speech recognition service", 502);
    }

    return jsonResponse({ transcript: data.text.trim(), model: "faster-whisper" });

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
