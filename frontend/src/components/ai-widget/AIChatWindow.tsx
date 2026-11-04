"use client";

import { useEffect, useRef } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatMessageList } from "./ChatMessageList";
import { ChatComposer } from "./ChatComposer";
import type { CopilotMessage } from "@/types/copilot";
import type { WidgetLanguage } from "./types";

interface AIChatWindowProps {
  isOpen: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onClear: () => void;
  messages: CopilotMessage[];
  isSending: boolean;
  error: string | null;
  onRetry?: () => void;
  onSendMessage: (text: string) => void;
  selectedLanguage: WidgetLanguage;
  onLanguageChange: (lang: WidgetLanguage) => void;
}

export function AIChatWindow({
  isOpen,
  onMinimize,
  onClose,
  onClear,
  messages,
  isSending,
  error,
  onRetry,
  onSendMessage,
  selectedLanguage,
  onLanguageChange
}: AIChatWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onMinimize();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onMinimize]);

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className="ai-chat-window-panel"
      role="dialog"
      aria-label="Amiro Intelligence Assistant"
      aria-modal="false"
    >
      <ChatHeader
        onMinimize={onMinimize}
        onClose={onClose}
        onClear={onClear}
        selectedLanguage={selectedLanguage}
        onLanguageChange={onLanguageChange}
      />

      <ChatMessageList
        messages={messages}
        isSending={isSending}
        error={error}
        onRetry={onRetry}
        onSelectSuggestion={onSendMessage}
      />

      <ChatComposer
        onSendMessage={onSendMessage}
        isSending={isSending}
        selectedLanguage={selectedLanguage}
        onLanguageChange={onLanguageChange}
      />
    </div>
  );
}

