"use client";

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from "react";
import { VoiceInputControl } from "./VoiceInputControl";
import type { WidgetLanguage } from "./types";

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  isSending: boolean;
  selectedLanguage: WidgetLanguage;
  onLanguageChange: (lang: WidgetLanguage) => void;
}

export function ChatComposer({
  onSendMessage,
  isSending,
  selectedLanguage,
  onLanguageChange
}: ChatComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to 120px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draft]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const clean = draft.trim();
    if (!clean || isSending) return;

    // Immediately clear input so text does not linger
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    onSendMessage(clean);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const baseDraftRef = useRef("");

  const handleVoiceListeningStart = () => {
    baseDraftRef.current = draft;
  };

  const handleVoiceLiveTranscript = (liveText: string) => {
    const base = baseDraftRef.current.trim();
    setDraft(base ? `${base} ${liveText}` : liveText);
  };

  const handleVoiceTranscript = (transcript: string) => {
    const base = baseDraftRef.current.trim();
    const finalResult = base ? `${base} ${transcript}` : transcript;
    setDraft(finalResult.trim());
    baseDraftRef.current = finalResult.trim();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <form className="ai-chat-composer" onSubmit={handleSubmit}>
      <div className="ai-composer-input-row">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Amiro Intelligence (Press Enter to send)..."
          rows={1}
          disabled={isSending}
          maxLength={2000}
          className="ai-composer-textarea"
          aria-label="Ask Amiro Intelligence"
        />

        <div className="ai-composer-actions-right">
          {/* Voice Input */}
          <VoiceInputControl
            onTranscript={handleVoiceTranscript}
            onLiveTranscript={handleVoiceLiveTranscript}
            onListeningStart={handleVoiceListeningStart}
            language={selectedLanguage}
            disabled={isSending}
          />

          {/* Send Button */}
          <button
            type="submit"
            className="ai-send-btn"
            disabled={!draft.trim() || isSending}
            title="Send message (Enter)"
            aria-label="Send message"
          >
            {isSending ? (
              <span className="ai-send-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="ai-composer-bottom-bar">
        <span className="ai-composer-shortcut-hint">
          <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for new line
        </span>
        <span className="ai-composer-disclaimer">
          Enterprise AI · Verified records
        </span>
      </div>
    </form>
  );
}

