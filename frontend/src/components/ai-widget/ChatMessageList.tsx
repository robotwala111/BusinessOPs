"use client";

import { useEffect, useRef } from "react";
import { ChatMessageItem } from "./ChatMessageItem";
import { WelcomeScreen } from "./WelcomeScreen";
import type { CopilotMessage } from "@/types/copilot";

interface ChatMessageListProps {
  messages: CopilotMessage[];
  isSending: boolean;
  error: string | null;
  onRetry?: () => void;
  onSelectSuggestion: (question: string) => void;
}

export function ChatMessageList({
  messages,
  isSending,
  error,
  onRetry,
  onSelectSuggestion
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message or when sending state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, error]);

  const hasOnlyInitial = messages.length <= 1;

  return (
    <div className="ai-chat-message-list" role="log" aria-live="polite">
      {hasOnlyInitial ? (
        <WelcomeScreen
          onSelectSuggestion={onSelectSuggestion}
          disabled={isSending}
        />
      ) : (
        <div className="ai-messages-flow">
          {messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))}
        </div>
      )}

      {/* Thinking / Typing Indicator */}
      {isSending && (
        <div className="ai-chat-bubble-row assistant">
          <div className="ai-bubble-avatar thinking" title="Amiro Intelligence">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
          </div>

          <div className="ai-bubble-wrapper">
            <div className="ai-bubble-content thinking-bubble">
              <div className="ai-typing-indicator">
                <span className="ai-typing-dot" />
                <span className="ai-typing-dot" />
                <span className="ai-typing-dot" />
              </div>
              <span className="ai-typing-label">Analyzing verified records…</span>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="ai-chat-error-banner" role="alert">
          <div className="ai-error-content">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          {onRetry && (
            <button type="button" className="ai-error-retry-btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      <div ref={bottomRef} style={{ height: "1px" }} />
    </div>
  );
}

