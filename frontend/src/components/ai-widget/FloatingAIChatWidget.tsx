"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { requireSupabase } from "@/services/moduleHelpers";
import { askAmiroIntelligenceDemo } from "@/services/amiroIntelligenceDemo";
import { FloatingChatLauncher } from "./FloatingChatLauncher";
import { AIChatWindow } from "./AIChatWindow";
import type { CopilotMessage, CopilotConversation, CopilotReply } from "@/types/copilot";
import type { WidgetLanguage } from "./types";

const INITIAL_WELCOME_MESSAGE: CopilotMessage = {
  id: "welcome-ai-msg-init",
  role: "assistant",
  content: "Hello! 👋 Welcome. I'm your AI assistant. How can I help you today?",
  records: [],
  created_at: new Date().toISOString()
};

async function authorizedFetch(url: string, init?: RequestInit) {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to use AI assistant.");
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "AI request failed.";
    throw new Error(message);
  }
  return payload;
}

export function FloatingAIChatWidget() {
  const { isConfigured } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<WidgetLanguage>("auto");
  const [messages, setMessages] = useState<CopilotMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [activeConversation, setActiveConversation] = useState<CopilotConversation | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setHasUnread(false);
      }
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setActiveConversation(null);
    setMessages([
      {
        ...INITIAL_WELCOME_MESSAGE,
        created_at: new Date().toISOString()
      }
    ]);
    setError(null);
    setLastQuestion(null);
  }, []);

  const sendMessage = async (text: string) => {
    const question = text.trim();
    if (!question || isSending) return;

    setError(null);
    setLastQuestion(question);
    setIsSending(true);

    const tempUserId = `user-${Date.now()}`;
    const tempUserMsg: CopilotMessage = {
      id: tempUserId,
      role: "user",
      content: question,
      records: [],
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      if (!isConfigured) {
        // High-speed verified local engine with multilingual synthesis
        const result = await askAmiroIntelligenceDemo(
          question,
          activeConversation?.id,
          selectedLanguage !== "auto" ? selectedLanguage : undefined
        );
        setActiveConversation(result.conversation);
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserId);
          return [...filtered, result.userMessage, result.assistantMessage];
        });
        return;
      }

      // Cloud authenticated endpoint
      const payload = (await authorizedFetch("/api/copilot", {
        method: "POST",
        body: JSON.stringify({
          message: question,
          conversationId: activeConversation?.id,
          language: selectedLanguage
        })
      })) as CopilotReply & { userMessage: CopilotMessage };

      setActiveConversation(payload.conversation);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserId);
        return [...filtered, payload.userMessage, payload.message];
      });
    } catch (cause) {
      console.error("AI chat error:", cause);
      setError(cause instanceof Error ? cause.message : "Unable to reach AI assistant. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = () => {
    if (lastQuestion) {
      void sendMessage(lastQuestion);
    }
  };

  return (
    <div className="ai-floating-widget-root" aria-live="polite">
      {/* Floating Expandable Chat Panel */}
      <AIChatWindow
        isOpen={isOpen}
        onMinimize={() => setIsOpen(false)}
        onClose={() => setIsOpen(false)}
        onClear={handleClear}
        messages={messages}
        isSending={isSending}
        error={error}
        onRetry={lastQuestion ? handleRetry : undefined}
        onSendMessage={sendMessage}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />

      {/* Floating Bottom-Right 60px Circular Launcher */}
      <FloatingChatLauncher
        isOpen={isOpen}
        hasUnread={hasUnread}
        onClick={handleToggle}
      />
    </div>
  );
}

