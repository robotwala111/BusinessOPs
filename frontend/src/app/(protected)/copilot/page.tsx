"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { requireSupabase } from "@/services/moduleHelpers";
import {
  askAmiroIntelligenceDemo,
  getDemoConversations,
  getDemoMessages
} from "@/services/amiroIntelligenceDemo";
import { useSpeechRecognition, SPEECH_LANGUAGES } from "@/hooks/useSpeechRecognition";
import type { CopilotConversation, CopilotMessage, CopilotRecord, CopilotReply } from "@/types/copilot";

const suggestions = [
  { text: "What is today's sales?", icon: "💰", color: "#10b981" },
  { text: "Show top clients by revenue", icon: "🏆", color: "#f59e0b" },
  { text: "Show overdue invoices", icon: "⚠️", color: "#ef4444" },
  { text: "What are outstanding receivables?", icon: "📊", color: "#3b82f6" },
  { text: "Analyze monthly expenses", icon: "📉", color: "#8b5cf6" },
  { text: "Show pending quotations", icon: "📋", color: "#06b6d4" },
  { text: "Which projects are delayed?", icon: "⏰", color: "#f97316" },
  { text: "Summarize monthly revenue", icon: "💵", color: "#14b8a6" }
];

type CopilotUsage = CopilotReply["usage"];

async function authorizedFetch(url: string, init?: RequestInit) {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in with Supabase to use Copilot.");
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
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Copilot request failed.";
    throw new Error(message);
  }
  return payload;
}

const INITIAL_GREETING_MESSAGE: CopilotMessage = {
  id: "msg-ai-greeting-init",
  role: "assistant",
  content: "Hello! 👋 Welcome to **Amiro Intelligence**.\n\n🚀 I'm your AI-powered business operations assistant, ready to help you make data-driven decisions!\n\n**What I can do for you:**\n\n📊 **Sales & Revenue Analytics**\n• Today's sales and collection status\n• Weekly/monthly trends and patterns\n• Top clients by revenue contribution\n\n💰 **Financial Intelligence**\n• Outstanding receivables and overdue invoices\n• Expense analysis by category\n• Payment collection rates and insights\n\n📋 **Operational Excellence**\n• Active projects and delivery timelines\n• Pending quotations and approvals\n• Support tickets and follow-ups\n\n**How to get started:**\n• 💬 Type your question below\n• 🎤 Click the microphone for voice input\n• 🌐 Select your preferred language\n• 📊 Try the suggested questions\n\nI'm here 24/7 to help you understand your business better. What would you like to know?",
  records: [],
  created_at: new Date().toISOString()
};

export default function CopilotPage() {
  const { isConfigured, isDemoMode } = useAuth();
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [conversation, setConversation] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([INITIAL_GREETING_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [error, setError] = useState("");
  const [lastUsage, setLastUsage] = useState<CopilotUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // FREE Web Speech API (browser native - no API costs!)
  const { 
    isListening, 
    isSupported: isVoiceSupported, 
    transcript, 
    startListening, 
    stopListening,
    resetTranscript 
  } = useSpeechRecognition({
    language: selectedLanguage !== "auto" && SPEECH_LANGUAGES[selectedLanguage as keyof typeof SPEECH_LANGUAGES] 
      ? SPEECH_LANGUAGES[selectedLanguage as keyof typeof SPEECH_LANGUAGES] 
      : 'en-IN',
    continuous: false,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal) {
        setDraft(text.trim());
        setError("");
      }
    },
    onError: (error) => {
      setError(`Voice input error: ${error}`);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const loadConversations = useCallback(async () => {
    if (!isConfigured) {
      setConversations(getDemoConversations());
      return;
    }
    const payload = await authorizedFetch("/api/copilot") as { conversations: CopilotConversation[] };
    setConversations(payload.conversations);
  }, [isConfigured]);

  useEffect(() => {
    void loadConversations()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load Copilot history."))
      .finally(() => setIsLoading(false));
  }, [loadConversations]);

  async function openConversation(item: CopilotConversation) {
    setError("");
    setIsLoading(true);
    try {
      if (!isConfigured) {
        setConversation(item);
        const msgs = getDemoMessages(item.id);
        setMessages(msgs.length > 0 ? msgs : [INITIAL_GREETING_MESSAGE]);
        setLastUsage(null);
        return;
      }
      const payload = await authorizedFetch(`/api/copilot?conversationId=${encodeURIComponent(item.id)}`) as {
        conversation: CopilotConversation;
        messages: CopilotMessage[];
      };
      setConversation(payload.conversation);
      setMessages(payload.messages.length > 0 ? payload.messages : [INITIAL_GREETING_MESSAGE]);
      setLastUsage(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load conversation.");
    } finally {
      setIsLoading(false);
    }
  }

  function startNewConversation() {
    setConversation(null);
    setMessages([INITIAL_GREETING_MESSAGE]);
    setDraft("");
    setError("");
    setLastUsage(null);
    setSelectedLanguage("auto");
  }

  function handleVoiceInput() {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setError("");
      startListening();
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>, suggestedQuestion?: string) {
    event?.preventDefault();
    const question = (suggestedQuestion ?? draft).trim();
    if (!question || isSending) return;

    // 1. Immediately clear the input box so the user's text does not linger!
    setDraft("");
    setError("");
    setIsSending(true);

    // 2. Optimistically display user's message in the chat immediately
    const tempUserId = `user-temp-${Date.now()}`;
    const tempUserMsg: CopilotMessage = {
      id: tempUserId,
      role: "user",
      content: question,
      records: [],
      created_at: new Date().toISOString()
    };
    setMessages((current) => [...current, tempUserMsg]);

    try {
      if (!isConfigured) {
        // Local sandbox engine running live calculations against verified demo records
        const result = await askAmiroIntelligenceDemo(question, conversation?.id, conversation?.language);
        setConversation(result.conversation);
        setMessages((current) => {
          const withoutTemp = current.filter((m) => m.id !== tempUserId);
          return [...withoutTemp, result.userMessage, result.assistantMessage];
        });
        await loadConversations();
        return;
      }

      const payload = await authorizedFetch("/api/copilot", {
        method: "POST",
        body: JSON.stringify({ 
          message: question, 
          conversationId: conversation?.id, 
          language: selectedLanguage !== "auto" ? selectedLanguage : conversation?.language
        })
      }) as CopilotReply & { userMessage: CopilotMessage };
      setConversation(payload.conversation);
      setMessages((current) => {
        const withoutTemp = current.filter((m) => m.id !== tempUserId);
        return [...withoutTemp, payload.userMessage, payload.message];
      });
      setLastUsage(payload.usage);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your question.");
      // Restore draft on failure so user does not lose input
      setDraft(question);
      setMessages((current) => current.filter((m) => m.id !== tempUserId));
      void loadConversations().catch(() => {
        setError((current) => `${current} Conversation history could not be refreshed.`);
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="copilot-page">
      <header className="copilot-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              boxShadow: "0 4px 14px rgba(102, 126, 234, 0.3)"
            }}>
              🤖
            </div>
            <div>
              <h1 style={{ margin: 0, lineHeight: 1.2 }}>Amiro Intelligence</h1>
              <p className="eyebrow" style={{ margin: "4px 0 0 0", fontSize: "0.85rem", fontWeight: 500, color: "#718096" }}>
                AI-Powered Business Intelligence
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "4px 12px",
                borderRadius: "20px",
                backgroundColor: isDemoMode ? "#fef3c7" : "#e0f2fe",
                color: isDemoMode ? "#b45309" : "#0369a1",
                border: "2px solid",
                borderColor: isDemoMode ? "#fde68a" : "#bae6fd",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}
            >
              {isDemoMode ? "🧪 Sandbox Mode" : "☁️ Cloud Connected"}
            </span>
            {isVoiceSupported && (
              <span style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: "20px",
                backgroundColor: "#ecfdf5",
                color: "#059669",
                border: "2px solid #a7f3d0",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>
                🎤 Voice Enabled
              </span>
            )}
          </div>
        </div>
        <button 
          type="button" 
          className="btn-secondary" 
          onClick={startNewConversation}
          style={{
            padding: "12px 24px",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "0.9rem",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
            transition: "all 0.3s ease"
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          ✨ New Conversation
        </button>
      </header>

      <div className="copilot-layout">
        <aside className="copilot-history card" aria-label="Conversation history">
          <h2>Conversations</h2>
          {isLoading && !conversation ? <p className="muted">Loading history…</p> : null}
          {!isLoading && conversations.length === 0 ? (
            <p className="muted">Your business inquiries will appear here.</p>
          ) : null}
          {conversations.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`copilot-history-item${conversation?.id === item.id ? " active" : ""}`}
              onClick={() => void openConversation(item)}
            >
              <span>{item.title}</span>
              <small>{new Date(item.updated_at).toLocaleDateString()}</small>
            </button>
          ))}
        </aside>

        <div className="copilot-chat card">
          {/* Enhanced Language Selector */}
          <div style={{ 
            padding: "16px 20px", 
            borderBottom: "2px solid rgba(102, 126, 234, 0.1)",
            background: "linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                fontSize: "20px",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
              }}>🌐</span>
              <label htmlFor="language-select" style={{ 
                fontSize: "0.9rem", 
                fontWeight: 700,
                color: "#2d3748",
                letterSpacing: "0.3px"
              }}>
                Response Language:
              </label>
              <select 
                id="language-select"
                value={selectedLanguage} 
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  if (conversation) {
                    setConversation({ ...conversation, language: e.target.value });
                  }
                }}
                style={{ 
                  padding: "8px 14px", 
                  fontSize: "0.9rem",
                  borderRadius: "10px",
                  border: "2px solid rgba(102, 126, 234, 0.2)",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "#2d3748",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  transition: "all 0.3s ease"
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "#667eea"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = "rgba(102, 126, 234, 0.2)"}
              >
                <option value="auto">🌍 Auto-detect</option>
                <option value="en">🇬🇧 English</option>
                <option value="hi">🇮🇳 हिंदी (Hindi)</option>
                <option value="te">🇮🇳 తెలుగు (Telugu)</option>
                <option value="ta">🇮🇳 தமிழ் (Tamil)</option>
                <option value="ml">🇮🇳 മലയാളം (Malayalam)</option>
                <option value="kn">🇮🇳 ಕನ್ನಡ (Kannada)</option>
                <option value="mr">🇮🇳 मराठी (Marathi)</option>
                <option value="bn">🇮🇳 বাংলা (Bengali)</option>
                <option value="gu">🇮🇳 ગુજરાતી (Gujarati)</option>
                <option value="ar">🇸🇦 العربية (Arabic)</option>
                <option value="es">🇪🇸 Español (Spanish)</option>
              </select>
            </div>
            {isVoiceSupported && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#059669",
                background: "rgba(16, 185, 129, 0.1)",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(16, 185, 129, 0.2)"
              }}>
                <span style={{ fontSize: "16px" }}>✓</span>
                Voice input ready
              </div>
            )}
          </div>

          <div className="copilot-messages" aria-live="polite">
            {messages.map((message) => (
              <article className={`copilot-message ${message.role}`} key={message.id}>
                <strong>
                  {message.role === "user" ? (
                    <>
                      <span style={{ fontSize: "18px" }}>👤</span> You
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "18px" }}>🤖</span> Amiro Intelligence
                    </>
                  )}
                </strong>
                <div style={{ whiteSpace: "pre-line", lineHeight: "1.7", fontSize: "0.95rem" }}>
                  {message.content}
                </div>
                {message.records?.length ? <RecordLinks records={message.records} /> : null}
              </article>
            ))}

            {messages.length === 1 && !isLoading ? (
              <div style={{ marginTop: "20px", marginBottom: "16px" }}>
                <div style={{ 
                  marginBottom: "24px",
                  padding: "24px",
                  background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
                  borderRadius: "16px",
                  border: "2px solid rgba(102, 126, 234, 0.15)",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>💡</div>
                  <p style={{ 
                    fontSize: "1.1rem", 
                    fontWeight: 700, 
                    marginBottom: "8px",
                    color: "#2d3748"
                  }}>
                    Try These Popular Questions
                  </p>
                  <p style={{
                    fontSize: "0.9rem",
                    color: "#718096",
                    margin: 0
                  }}>
                    Click any card below or use 🎤 voice input to get instant insights
                  </p>
                </div>
                
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "16px"
                }}>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.text}
                      type="button"
                      disabled={isSending}
                      onClick={() => void sendMessage(undefined, suggestion.text)}
                      style={{ 
                        textAlign: "left",
                        padding: "20px",
                        background: "white",
                        border: "2px solid rgba(102, 126, 234, 0.15)",
                        borderRadius: "14px",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        position: "relative",
                        overflow: "hidden"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = "0 8px 24px rgba(102, 126, 234, 0.15)";
                        e.currentTarget.style.borderColor = "rgba(102, 126, 234, 0.4)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                        e.currentTarget.style.borderColor = "rgba(102, 126, 234, 0.15)";
                      }}
                    >
                      <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: `${suggestion.color}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                        flexShrink: 0
                      }}>
                        {suggestion.icon}
                      </div>
                      <span style={{
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        color: "#2d3748",
                        lineHeight: 1.4
                      }}>
                        {suggestion.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {isSending ? (
              <article className="copilot-message assistant" style={{ opacity: 0.95 }}>
                <strong>
                  <span style={{ fontSize: "18px" }}>🤖</span> Amiro Intelligence
                </strong>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <div style={{ 
                    display: "flex", 
                    gap: "4px" 
                  }}>
                    <span style={{ 
                      display: "inline-block", 
                      width: "8px", 
                      height: "8px", 
                      borderRadius: "50%", 
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                      animation: "pulse 1.2s infinite" 
                    }} />
                    <span style={{ 
                      display: "inline-block", 
                      width: "8px", 
                      height: "8px", 
                      borderRadius: "50%", 
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                      animation: "pulse 1.2s infinite 0.2s" 
                    }} />
                    <span style={{ 
                      display: "inline-block", 
                      width: "8px", 
                      height: "8px", 
                      borderRadius: "50%", 
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                      animation: "pulse 1.2s infinite 0.4s" 
                    }} />
                  </div>
                  <span style={{ fontSize: "0.9rem", color: "#718096", fontWeight: 600 }}>
                    Analyzing your business data...
                  </span>
                </div>
              </article>
            ) : null}
            {isLoading && conversation ? <p className="muted">Loading conversation…</p> : null}
            <div ref={messagesEndRef} />
          </div>

          {error ? (
            <div className="form-error" role="alert" style={{
              padding: "14px 18px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.05) 100%)",
              border: "2px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
              <span style={{ fontSize: "20px" }}>⚠️</span>
              <span style={{ fontWeight: 600 }}>{error}</span>
            </div>
          ) : null}
          
          {lastUsage ? (
            <small className="copilot-disclaimer" style={{
              padding: "10px 14px",
              background: "rgba(102, 126, 234, 0.05)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.8rem",
              color: "#718096"
            }}>
              <span>📊</span>
              Usage logged · {lastUsage.input_tokens + lastUsage.output_tokens} tokens 
              {lastUsage.estimated_cost_usd ? ` · $${lastUsage.estimated_cost_usd.toFixed(6)} USD` : ''}
            </small>
          ) : null}

          <form className="copilot-composer" onSubmit={(event) => void sendMessage(event)}>
            <label className="sr-only" htmlFor="copilot-question">Ask Amiro Intelligence</label>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <textarea
                  id="copilot-question"
                  value={isListening ? transcript : draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={
                    isListening 
                      ? "🎤 Listening... Speak clearly" 
                      : "Ask about sales, revenue, clients, invoices, or click 🎤 for voice..."
                  }
                  maxLength={2000}
                  rows={3}
                  disabled={isSending || isListening}
                  style={{
                    width: "100%",
                    padding: "16px",
                    fontSize: "0.95rem",
                    borderRadius: "14px",
                    border: isListening 
                      ? "3px solid #ef4444" 
                      : "2px solid rgba(102, 126, 234, 0.15)",
                    backgroundColor: isListening ? "#fef2f2" : "white",
                    resize: "vertical",
                    fontFamily: "inherit",
                    transition: "all 0.3s ease",
                    boxShadow: isListening ? "0 0 0 4px rgba(239, 68, 68, 0.1)" : "0 2px 8px rgba(0,0,0,0.04)"
                  }}
                />
                {isListening && (
                  <div style={{ 
                    position: "absolute",
                    bottom: "14px",
                    left: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.85rem",
                    color: "#ef4444",
                    fontWeight: 700,
                    background: "white",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.2)"
                  }}>
                    <span style={{ 
                      display: "inline-block", 
                      width: "10px", 
                      height: "10px", 
                      borderRadius: "50%", 
                      background: "#ef4444", 
                      animation: "pulse 1s infinite" 
                    }} />
                    Recording... Click 🎤 to stop
                  </div>
                )}
              </div>
              
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  disabled={isSending}
                  style={{
                    padding: "16px 20px",
                    backgroundColor: isListening ? "#ef4444" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    background: isListening ? "#ef4444" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "14px",
                    cursor: isSending ? "not-allowed" : "pointer",
                    fontSize: "28px",
                    lineHeight: 1,
                    transition: "all 0.3s ease",
                    opacity: isSending ? 0.5 : 1,
                    boxShadow: isListening 
                      ? "0 0 0 4px rgba(239, 68, 68, 0.2), 0 4px 16px rgba(239, 68, 68, 0.3)" 
                      : "0 4px 16px rgba(102, 126, 234, 0.3)",
                    transform: isListening ? "scale(1.05)" : "scale(1)"
                  }}
                  title={isListening ? "Click to stop recording" : "Click to start voice input"}
                  aria-label={isListening ? "Stop recording" : "Start voice input"}
                  onMouseOver={(e) => !isListening && !isSending && (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseOut={(e) => !isListening && (e.currentTarget.style.transform = "scale(1)")}
                >
                  {isListening ? "⏹️" : "🎤"}
                </button>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={!draft.trim() || isSending || isListening}
              style={{
                marginTop: "12px",
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.3px"
              }}
            >
              {isSending ? (
                <>
                  <span style={{ marginRight: "8px" }}>⚙️</span>
                  Analyzing...
                </>
              ) : (
                <>
                  <span style={{ marginRight: "8px" }}>✨</span>
                  Ask Assistant
                </>
              )}
            </button>
          </form>
          
          <small className="copilot-disclaimer" style={{
            textAlign: "center",
            padding: "12px",
            background: "rgba(102, 126, 234, 0.03)",
            borderRadius: "10px",
            fontSize: "0.8rem",
            color: "#a0aec0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}>
            <span>🔒</span>
            Secure AI-powered insights from your verified business data
          </small>
        </div>
      </div>
    </section>
  );
}

function RecordLinks({ records }: { records: CopilotRecord[] }) {
  return (
    <ul className="copilot-record-links">
      {records.map((record) => (
        <li key={`${record.entity}-${record.id}`}>
          <Link href={record.href}>
            <strong>{record.label}</strong>
            <span>{record.detail}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
