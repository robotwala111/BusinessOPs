"use client";

import { useState, useEffect, useRef } from "react";
import type { WidgetLanguage } from "./types";
import { SUPPORTED_SPEECH_LANGUAGES } from "@/lib/speechLanguage";

interface VoiceInputControlProps {
  onTranscript: (text: string) => void;
  language: WidgetLanguage;
  disabled?: boolean;
}

export function VoiceInputControl({ onTranscript, language, disabled }: VoiceInputControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessingWhisper, setIsProcessingWhisper] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const getLanguageLabel = () => {
    if (language === "auto") return "Auto-detect language";
    return SUPPORTED_SPEECH_LANGUAGES[language]?.nativeName || language.toUpperCase();
  };

  const startListening = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support microphone recording.");
      }
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = audioStream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mimeType
        ? new MediaRecorder(audioStream, { mimeType })
        : new MediaRecorder(audioStream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setErrorMsg(error instanceof Error ? error.message : "Microphone permission denied or unavailable.");
    }
  };

  const stopListening = () => {
    setIsListening(false);
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;

      if (audioBlob.size <= 2000) {
        setErrorMsg("No speech was recorded. Please try again.");
        return;
      }

      setIsProcessingWhisper(true);
      try {
        const formData = new FormData();
        const filename = recorder.mimeType.includes("mp4")
          ? "speech.mp4"
          : recorder.mimeType.includes("ogg") ? "speech.ogg" : "speech.webm";
        formData.append("file", audioBlob, filename);
        if (language && language !== "auto") formData.append("language", language);
        const response = await fetch("/api/ai/voice/transcribe", { method: "POST", body: formData });
        const data = await response.json().catch(() => null) as { text?: unknown; error?: unknown } | null;
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Local Whisper transcription failed.");
        if (typeof data?.text !== "string" || !data.text.trim()) {
          setErrorMsg("Whisper did not detect speech. Try speaking more clearly or select the language manually.");
          return;
        }
        onTranscript(data.text.trim());
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Local Whisper is unavailable.");
      } finally {
        setIsProcessingWhisper(false);
      }
    };
    recorder.stop();
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="ai-voice-control-wrap">
      {/* Mic trigger button */}
      <button
        type="button"
        className={`ai-composer-action-btn ${isListening ? "listening" : ""} ${isProcessingWhisper ? "processing" : ""}`}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isProcessingWhisper}
        title={
          isListening
            ? "Stop listening (Done)"
            : `Click to speak (${getLanguageLabel()}) - Speech to Text`
        }
        aria-label={isListening ? "Stop listening" : "Start voice input"}
      >
        {isListening ? (
          <span className="ai-voice-active-pulse">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </span>
        ) : isProcessingWhisper ? (
          <span className="ai-voice-spinner" title="Transcribing with Whisper AI...">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
          </span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {/* Listening overlay banner */}
      {isListening && (
        <div className="ai-voice-listening-banner">
          <div className="ai-voice-wave-animation">
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
          </div>
          <div className="ai-voice-info-col">
            <span className="ai-voice-status-text">
              {`Listening in ${getLanguageLabel()}... Speak now`}
            </span>
            <span className="ai-voice-badge">Recorded locally · Transcribed by Whisper</span>
          </div>
          <button
            type="button"
            className="ai-voice-done-btn"
            onClick={stopListening}
          >
            Done
          </button>
        </div>
      )}

      {/* Whisper Processing Banner */}
      {isProcessingWhisper && (
        <div className="ai-voice-listening-banner">
          <span className="ai-voice-status-text">
            ✨ Transcribing voice with Whisper AI...
          </span>
        </div>
      )}

      {/* Error feedback */}
      {errorMsg && (
        <div className="ai-voice-error-toast" role="alert">
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
