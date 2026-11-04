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

const GREETING_BY_LANG: Record<string, string> = {
  te: "నమస్కారం! 👋 స్వాగతం. నేను మీ AI సహాయకుడిని. ఈరోజు నేను మీకు ఎలా సహాయపడగలను?",
  hi: "नमस्ते! 👋 स्वागत है। मैं आपका AI सहायक हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?",
  kn: "ನಮಸ್ಕಾರ! 👋 ಸುಸ್ವಾಗತ. ನಾನು ನಿಮ್ಮ AI ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
  ta: "வணக்கம்! 👋 வருக. நான் உங்கள் AI உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதవ முடியும்?",
  ml: "നമസ്കാരം! 👋 സ്വാഗതം. ഞാൻ നിങ്ങളുടെ AI അസിസ്റ്റന്റാണ്. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?",
  mr: "नमस्कार! 👋 स्वागत आहे. मी तुमचा AI सहाय्यक आहे. आज मी तुम्हाला कशी मदत करू शकतो?",
  bn: "নমস্কার! 👋 স্বাগতম। আমি আপনার এআই সহকারী। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
  gu: "નમસ્તે! 👋 સ્વાગત છે. હું તમારો AI સહાયક છું. આજે હું તમને કેવી રીતે મદદ કરી શકું?",
  ar: "مرحباً! 👋 أهلاً بك. أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟",
  default: "Hello! 👋 Welcome. I'm your AI assistant. How can I help you today?"
};

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

  const handleLanguageChange = useCallback((newLang: WidgetLanguage) => {
    setSelectedLanguage(newLang);
    if (activeConversation) {
      setActiveConversation((prev) => (prev ? { ...prev, language: newLang } : null));
    }
    setMessages((current) => {
      if (current.length <= 1) {
        return [
          {
            ...INITIAL_WELCOME_MESSAGE,
            content: GREETING_BY_LANG[newLang] || GREETING_BY_LANG.default,
            created_at: new Date().toISOString()
          }
        ];
      }
      return current;
    });
  }, [activeConversation]);

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
        content: GREETING_BY_LANG[selectedLanguage] || GREETING_BY_LANG.default,
        created_at: new Date().toISOString()
      }
    ]);
    setError(null);
    setLastQuestion(null);
  }, [selectedLanguage]);

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

    // Sticky language:
    // If user explicitly picked a language from the dropdown (not "auto"), strictly enforce it.
    // If "auto", leave targetLang undefined so every question's language is auto-detected dynamically.
    const targetLang = selectedLanguage !== "auto" ? selectedLanguage : undefined;

    try {
      if (!isConfigured) {
        // High-speed verified local engine with dynamic auto-detection or strict language locking
        const result = await askAmiroIntelligenceDemo(
          question,
          activeConversation?.id,
          targetLang
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
          language: targetLang
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
        onLanguageChange={handleLanguageChange}
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

