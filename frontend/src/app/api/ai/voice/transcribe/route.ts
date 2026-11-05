import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file") || formData.get("audio");
    const audioFilename = audioFile instanceof File && audioFile.name ? audioFile.name : "speech.webm";
    const language = (formData.get("language") as string) || "auto";

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio file is required for transcription." },
        { status: 400 }
      );
    }
    if (audioFile.size === 0 || audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio must be between 1 byte and 25 MB." }, { status: 413 });
    }

    const whisperEndpoint = process.env.WHISPER_BASE_URL?.trim();
    if (!whisperEndpoint) {
      return NextResponse.json({ error: "Local Whisper is not running or WHISPER_BASE_URL is not configured." }, { status: 503 });
    }

    const cleanUrl = whisperEndpoint.replace(/\/+$/, "");
    const targetUrl = cleanUrl.endsWith("/v1")
      ? `${cleanUrl}/audio/transcriptions`
      : `${cleanUrl}/v1/audio/transcriptions`;
    const outForm = new FormData();
    outForm.append("file", audioFile, audioFilename);
    outForm.append("model", process.env.WHISPER_MODEL || "whisper-1");
    if (language && language !== "auto") outForm.append("language", language);

    const response = await fetch(targetUrl, {
      method: "POST",
      body: outForm,
      signal: AbortSignal.timeout(120000),
      cache: "no-store"
    });
    if (!response.ok) {
      console.error("Local Whisper request failed", { status: response.status });
      return NextResponse.json({ error: "Local Whisper could not transcribe this audio." }, { status: 502 });
    }
    const data = await response.json() as { text?: unknown; language?: unknown };
    if (typeof data.text !== "string") {
      return NextResponse.json({ error: "Local Whisper returned an invalid transcription." }, { status: 502 });
    }
    return NextResponse.json({ text: data.text.trim(), language: data.language, model: "faster-whisper" }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Local Whisper took too long. Try a shorter clip or a smaller model." }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
