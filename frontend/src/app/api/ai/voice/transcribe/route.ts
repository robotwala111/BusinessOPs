import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file") || formData.get("audio");
    const language = (formData.get("language") as string) || "auto";

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio file is required for transcription." },
        { status: 400 }
      );
    }

    // Connect to Whisper endpoint if configured (e.g. OpenAI Whisper or Whisper.cpp / Faster-Whisper server)
    const whisperEndpoint = process.env.WHISPER_BASE_URL || process.env.AI_BASE_URL;
    if (whisperEndpoint) {
      const cleanUrl = whisperEndpoint.replace(/\/+$/, "");
      const targetUrl = cleanUrl.endsWith("/v1")
        ? `${cleanUrl}/audio/transcriptions`
        : `${cleanUrl}/v1/audio/transcriptions`;

      try {
        const outForm = new FormData();
        outForm.append("file", audioFile, "audio.webm");
        outForm.append("model", process.env.WHISPER_MODEL || "whisper-1");
        if (language && language !== "auto") {
          outForm.append("language", language);
        }

        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.AI_API_KEY || "ollama"}`
          },
          body: outForm,
          signal: AbortSignal.timeout(20000)
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.text || data.transcription || "";
          if (text) {
            return NextResponse.json({ text: text.trim(), model: "whisper" });
          }
        }
      } catch (err) {
        console.warn("Whisper audio transcription endpoint error:", err);
      }
    }

    return NextResponse.json({
      text: "",
      note: "Audio received. Browser Speech Recognition active.",
      fallback: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
