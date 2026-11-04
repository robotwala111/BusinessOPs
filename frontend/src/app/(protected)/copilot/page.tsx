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
import type { CopilotConversation, CopilotMessage, CopilotRecord, CopilotReply } from "@/types/copilot";

const suggestions = [
  "Summarize today's business activities.",
  "Show overdue invoices.",
  "Which clients need follow-up?",
  "Show pending quotations.",
  "Which projects are delayed?",
  "Summarize monthly revenue and expenses.",
  "Which contracts are expiring?",
  "Show unresolved support tickets."
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

export default function CopilotPage() {
  const { isConfigured, isDemoMode } = useAuth();
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [conversation, setConversation] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [lastUsage, setLastUsage] = useState<CopilotUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
        setMessages(getDemoMessages(item.id));
        setLastUsage(null);
        return;
      }
      const payload = await authorizedFetch(`/api/copilot?conversationId=${encodeURIComponent(item.id)}`) as {
        conversation: CopilotConversation;
        messages: CopilotMessage[];
      };
      setConversation(payload.conversation);
      setMessages(payload.messages);
      setLastUsage(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load conversation.");
    } finally {
      setIsLoading(false);
    }
  }

  function startNewConversation() {
    setConversation(null);
    setMessages([]);
    setDraft("");
    setError("");
    setLastUsage(null);
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
        const result = await askAmiroIntelligenceDemo(question, conversation?.id);
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
        body: JSON.stringify({ message: question, conversationId: conversation?.id })
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Business intelligence</p>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: isDemoMode ? "var(--color-warning-subtle, #fef3c7)" : "var(--color-primary-subtle, #e0f2fe)",
                color: isDemoMode ? "#b45309" : "#0369a1",
                border: "1px solid rgba(0,0,0,0.06)"
              }}
            >
              {isDemoMode ? "Sandbox Intelligence Engine" : "Cloud LLM Connected"}
            </span>
          </div>
          <h1>Amiro Intelligence</h1>
          <p className="muted">Live operational intelligence, instant financial calculations, and risk detection across your business.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={startNewConversation}>
          + New conversation
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
          <div className="copilot-messages" aria-live="polite">
            {messages.length === 0 && !isLoading ? (
              <div className="copilot-welcome">
                <h2>How can Amiro Intelligence assist your operations today?</h2>
                <p className="muted">
                  Ask natural-language business questions. All calculations are executed directly against authorized operational and financial records.
                </p>
                <div className="copilot-suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="btn-secondary"
                      disabled={isSending}
                      onClick={() => void sendMessage(undefined, suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article className={`copilot-message ${message.role}`} key={message.id}>
                <strong>{message.role === "user" ? "You" : "Amiro Intelligence"}</strong>
                <div style={{ whiteSpace: "pre-line", lineHeight: "1.6" }}>
                  {message.content}
                </div>
                {message.records?.length ? <RecordLinks records={message.records} /> : null}
              </article>
            ))}

            {isSending ? (
              <article className="copilot-message assistant" style={{ opacity: 0.9 }}>
                <strong>Amiro Intelligence</strong>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.2s infinite" }} />
                  <span style={{ fontSize: "13px", color: "var(--text-secondary, #64748b)" }}>Analyzing verified enterprise records…</span>
                </div>
              </article>
            ) : null}
            {isLoading && conversation ? <p className="muted">Loading conversation…</p> : null}
            <div ref={messagesEndRef} />
          </div>

          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {lastUsage ? (
            <small className="copilot-disclaimer">
              Usage logged · {lastUsage.input_tokens + lastUsage.output_tokens} tokens · estimated ${lastUsage.estimated_cost_usd?.toFixed(6)} USD
            </small>
          ) : null}

          <form className="copilot-composer" onSubmit={(event) => void sendMessage(event)}>
            <label className="sr-only" htmlFor="copilot-question">Ask Amiro Intelligence</label>
            <textarea
              id="copilot-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask about invoices, pending quotes, cashflow, delayed projects, or follow-ups (Press Enter to send)…"
              maxLength={2000}
              rows={3}
              disabled={isSending}
            />
            <button type="submit" disabled={!draft.trim() || isSending}>
              {isSending ? "Analyzing…" : "Ask Assistant"}
            </button>
          </form>
          <small className="copilot-disclaimer">
            Read-only analytical responses computed strictly from verified business records. Intelligence does not unilaterally modify production data.
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
