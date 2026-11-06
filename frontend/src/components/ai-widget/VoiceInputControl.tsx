"use client";

import { useState, useEffect, useRef } from "react";
import type { WidgetLanguage } from "./types";
import { SUPPORTED_SPEECH_LANGUAGES } from "@/lib/speechLanguage";

interface VoiceInputControlProps {
  onTranscript: (text: string) => void;
  onLiveTranscript?: (text: string) => void;
  onListeningStart?: () => void;
  language: WidgetLanguage;
  disabled?: boolean;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionClass(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function VoiceInputControl({
  onTranscript,
  onLiveTranscript,
  onListeningStart,
  language,
  disabled
}: VoiceInputControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessingWhisper, setIsProcessingWhisper] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const hasCapturedSpeechRef = useRef(false);
  const lastSpokenTextRef = useRef("");
  const isListeningRef = useRef(false);

  const getLanguageLabel = () => {
    if (language === "auto") return "Auto-detect language";
    return SUPPORTED_SPEECH_LANGUAGES[language]?.nativeName || language.toUpperCase();
  };

  const getRecognitionLang = (lang: WidgetLanguage): string => {
    if (lang && lang !== "auto" && SUPPORTED_SPEECH_LANGUAGES[lang]?.tag) {
      return SUPPORTED_SPEECH_LANGUAGES[lang].tag;
    }
    return (typeof navigator !== "undefined" && navigator.language) || "en-IN";
  };

  const stopAudioTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startListening = async () => {
    setErrorMsg(null);
    setLiveText("");
    audioChunksRef.current = [];
    hasCapturedSpeechRef.current = false;
    lastSpokenTextRef.current = "";

    onListeningStart?.();

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support microphone recording.");
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = audioStream;

      // Start MediaRecorder in parallel for neural Whisper fallback
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

      // Start Web Speech API for instant, live real-time speech streaming
      const SpeechRecognitionClass = getSpeechRecognitionClass();
      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = getRecognitionLang(language);

          recognition.onresult = (event: any) => {
            let interim = "";
            let final = "";
            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res && res[0]) {
                if (res.isFinal) {
                  final += res[0].transcript;
                } else {
                  interim += res[0].transcript;
                }
              }
            }
            const fullText = (final + (interim ? (final ? " " : "") + interim : "")).trim();
            if (fullText) {
              hasCapturedSpeechRef.current = true;
              lastSpokenTextRef.current = fullText;
              setLiveText(fullText);
              onLiveTranscript?.(fullText);
            }
          };

          recognition.onerror = (event: any) => {
            if (event.error !== "no-speech") {
              console.warn("SpeechRecognition notice:", event.error);
            }
          };

          recognition.onend = () => {
            // If still marked as listening and no final text yet, attempt seamless restart
            if (isListeningRef.current && !hasCapturedSpeechRef.current) {
              try {
                recognition.start();
              } catch {
                // Ignore if already running or browser blocked restart
              }
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (err) {
          console.warn("Web Speech API initialization fallback to Whisper:", err);
        }
      }

      isListeningRef.current = true;
      setIsListening(true);
    } catch (error) {
      stopAudioTracks();
      setErrorMsg(error instanceof Error ? error.message : "Microphone permission denied or unavailable.");
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);

    // Stop Web Speech recognition cleanly
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Safe ignore
      }
      speechRecognitionRef.current = null;
    }

    // 1. If real-time recognition already captured speech, commit it immediately
    if (hasCapturedSpeechRef.current && lastSpokenTextRef.current.trim()) {
      onTranscript(lastSpokenTextRef.current.trim());
      stopAudioTracks();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Safe ignore
        }
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      return;
    }

    // 2. Otherwise fallback to local neural Whisper transcription
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopAudioTracks();
      return;
    }

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];
      stopAudioTracks();
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
      isListeningRef.current = false;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // Safe ignore
        }
      }
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Safe ignore
        }
      }
      stopAudioTracks();
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
            <span className={`ai-voice-status-text ${liveText ? "live-streaming" : ""}`}>
              {liveText ? `“${liveText}”` : `Listening in ${getLanguageLabel()}... Speak now`}
            </span>
            <span className="ai-voice-badge">
              {liveText ? "● Live recognition · Instant typing" : "Recorded locally · Whisper Neural AI"}
            </span>
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
