"use client";

import { useState, useEffect, useRef } from "react";
import type { WidgetLanguage } from "./types";
import { SUPPORTED_SPEECH_LANGUAGES } from "@/lib/speechLanguage";

interface VoiceInputControlProps {
  onTranscript: (text: string) => void;
  language: WidgetLanguage;
  disabled?: boolean;
}

// Map widget language codes to BCP 47 language tags for SpeechRecognition
const SPEECH_LANG_MAP: Record<WidgetLanguage, string> = {
  auto: "en-IN",
  en: "en-IN",
  te: "te-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  ar: "ar-SA"
};

// Global type for Web Speech API
type SpeechRecognitionType = any;

export function VoiceInputControl({ onTranscript, language, disabled }: VoiceInputControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessingWhisper, setIsProcessingWhisper] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const interimAccumulatorRef = useRef<string>("");
  const streamRef = useRef<MediaStream | null>(null);

  // Check Web Speech API support
  const isWebSpeechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const getLanguageLabel = () => {
    if (language === "auto") return "Auto-detect / Indian English";
    return SUPPORTED_SPEECH_LANGUAGES[language]?.nativeName || language.toUpperCase();
  };

  const startListening = async () => {
    setErrorMsg(null);
    setInterimText("");
    interimAccumulatorRef.current = "";
    audioChunksRef.current = [];

    // 1. Try to initialize microphone MediaStream for parallel Whisper recording
    let audioStream: MediaStream | null = null;
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = audioStream;

        if (typeof MediaRecorder !== "undefined") {
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";

          const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };
          mediaRecorderRef.current = recorder;
          recorder.start(250); // Slice every 250ms
        }
      }
    } catch (micErr) {
      console.warn("MediaRecorder mic access warning:", micErr);
    }

    // 2. Initialize Web Speech API for real-time live word streaming
    if (isWebSpeechSupported) {
      try {
        const SpeechRecognitionConstructor =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = SPEECH_LANG_MAP[language] || "en-IN";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          let currentInterim = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptChunk;
            } else {
              currentInterim += transcriptChunk;
            }
          }

          if (finalTranscript) {
            onTranscript(finalTranscript.trim());
            interimAccumulatorRef.current = "";
            setInterimText("");
          } else if (currentInterim) {
            interimAccumulatorRef.current = currentInterim;
            setInterimText(currentInterim);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setErrorMsg("Microphone permission denied. Please allow microphone access in your browser.");
            stopListening();
          } else if (event.error === "no-speech") {
            // Keep listening or allow user to speak
          } else {
            setErrorMsg(`Voice input: ${event.error}`);
          }
        };

        recognition.onend = () => {
          // Flush any remaining interim speech chunk if recognition ended unexpectedly
          if (interimAccumulatorRef.current.trim()) {
            onTranscript(interimAccumulatorRef.current.trim());
            interimAccumulatorRef.current = "";
            setInterimText("");
          }
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        return;
      } catch (err) {
        console.warn("Web Speech API start error:", err);
      }
    }

    // 3. Fallback: If Web Speech is unsupported or failed, rely entirely on MediaRecorder + Whisper
    if (audioStream) {
      setIsListening(true);
    } else {
      setErrorMsg("Voice input is not supported or microphone access was denied.");
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const stopListening = async () => {
    // 1. Immediately flush any pending interim transcript text so no spoken words are lost
    const pendingInterim = interimAccumulatorRef.current.trim() || interimText.trim();
    if (pendingInterim) {
      onTranscript(pendingInterim);
    }
    interimAccumulatorRef.current = "";
    setInterimText("");
    setIsListening(false);

    // 2. Stop Web Speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // 3. Stop MediaRecorder and trigger Whisper AI transcription if needed
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];

        // Close mic tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        // If no text was recognized by Web Speech, query Whisper AI endpoint
        if (!pendingInterim && audioBlob.size > 2000) {
          setIsProcessingWhisper(true);
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, "speech.webm");
            if (language && language !== "auto") {
              formData.append("language", language);
            }

            const res = await fetch("/api/ai/voice/transcribe", {
              method: "POST",
              body: formData
            });

            if (res.ok) {
              const data = await res.json();
              if (data && typeof data.text === "string" && data.text.trim()) {
                onTranscript(data.text.trim());
              }
            }
          } catch (whisperErr) {
            console.warn("Whisper transcription error:", whisperErr);
          } finally {
            setIsProcessingWhisper(false);
          }
        }
      };

      try {
        recorder.stop();
      } catch {
        // ignore
      }
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
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
              {interimText ? `"${interimText}..."` : `Listening in ${getLanguageLabel()}... Speak now`}
            </span>
            <span className="ai-voice-badge">Whisper AI + Voice Recognition</span>
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
