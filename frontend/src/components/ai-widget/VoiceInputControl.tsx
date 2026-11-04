"use client";

import { useState, useEffect, useRef } from "react";
import type { WidgetLanguage } from "./types";

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

// Global types for webkitSpeechRecognition
type SpeechRecognitionType = any;

export function VoiceInputControl({ onTranscript, language, disabled }: VoiceInputControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // Check browser support
  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = () => {
    if (!isSupported) {
      setErrorMsg("Voice input is not supported in this browser. Please try Chrome or Edge.");
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    try {
      const SpeechRecognitionConstructor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = SPEECH_LANG_MAP[language] || "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
        setInterimText("");
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
          onTranscript(finalTranscript);
          setInterimText("");
        } else if (currentInterim) {
          setInterimText(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMsg("Microphone permission denied. Please allow microphone access in your browser.");
        } else if (event.error === "no-speech") {
          setErrorMsg("No speech detected. Please speak closer to your microphone.");
        } else {
          setErrorMsg(`Voice error: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setErrorMsg(null), 4500);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start voice recognition:", err);
      setErrorMsg("Unable to access microphone.");
      setIsListening(false);
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimText("");
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="ai-voice-control-wrap">
      {/* Mic trigger button */}
      <button
        type="button"
        className={`ai-composer-action-btn ${isListening ? "listening" : ""}`}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        title={isListening ? "Stop listening" : "Click to speak (Voice input)"}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
      >
        {isListening ? (
          <span className="ai-voice-active-pulse">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="6" y="6" width="12" height="12" rx="2" />
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
          <span className="ai-voice-status-text">
            {interimText ? `"${interimText}..."` : "Listening... Speak now"}
          </span>
          <button
            type="button"
            className="ai-voice-done-btn"
            onClick={stopListening}
          >
            Done
          </button>
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

