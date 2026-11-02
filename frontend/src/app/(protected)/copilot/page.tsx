"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { requireSupabase } from "@/services/moduleHelpers";
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
  const { isConfigured } = useAuth();
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [conversation, setConversation] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [lastUsage, setLastUsage] = useState<CopilotUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const loadConversations = useCallback(async () => {
    const payload = await authorizedFetch("/api/copilot") as { conversations: CopilotConversation[] };
    setConversations(payload.conversations);
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      setError("Copilot requires a configured Supabase account. Demo mode is not supported.");
      return;
    }
    void loadConversations()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load Copilot history."))
      .finally(() => setIsLoading(false));
  }, [isConfigured, loadConversations]);

  async function openConversation(item: CopilotConversation) {
    setError("");
    setIsLoading(true);
    try {
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
    setError("");
    setIsSending(true);
    try {
      const payload = await authorizedFetch("/api/copilot", {
        method: "POST",
        body: JSON.stringify({ message: question, conversationId: conversation?.id })
      }) as CopilotReply & { userMessage: CopilotMessage };
      setConversation(payload.conversation);
      setMessages((current) => [...current, payload.userMessage, payload.message]);
      setLastUsage(payload.usage);
      setDraft("");
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your question.");
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
          <p className="eyebrow">Business intelligence</p>
          <h1>AI Business Copilot</h1>
          <p className="muted">Ask questions about business records you’re authorized to see.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={startNewConversation}>New conversation</button>
      </header>

      <div className="copilot-layout">
        <aside className="copilot-history card" aria-label="Conversation history">
          <h2>History</h2>
          {isLoading && !conversation ? <p className="muted">Loading history…</p> : null}
          {!isLoading && conversations.length === 0 ? <p className="muted">Your conversations will appear here.</p> : null}
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
                <h2>What would you like to know?</h2>
                <p className="muted">Answers use live, read-only business data. Financial totals are calculated from records.</p>
                <div className="copilot-suggestions">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" className="btn-secondary" disabled={isSending || !isConfigured} onClick={() => void sendMessage(undefined, suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message) => (
              <article className={`copilot-message ${message.role}`} key={message.id}>
                <strong>{message.role === "user" ? "You" : "Business Copilot"}</strong>
                <p>{message.content}</p>
                {message.records?.length ? <RecordLinks records={message.records} /> : null}
              </article>
            ))}
            {isSending ? <p className="copilot-pending" role="status">Checking authorized records and preparing an answer…</p> : null}
            {isLoading && conversation ? <p className="muted">Loading conversation…</p> : null}
          </div>

          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {lastUsage ? (
            <small className="copilot-disclaimer">
              Usage logged · {lastUsage.input_tokens + lastUsage.output_tokens} tokens · estimated ${lastUsage.estimated_cost_usd?.toFixed(6)} USD
            </small>
          ) : null}
          <form className="copilot-composer" onSubmit={(event) => void sendMessage(event)}>
            <label className="sr-only" htmlFor="copilot-question">Ask the Business Copilot</label>
            <textarea
              id="copilot-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about invoices, quotations, projects, follow-ups…"
              maxLength={2000}
              rows={3}
              disabled={!isConfigured || isSending}
            />
            <button type="submit" disabled={!draft.trim() || isSending || !isConfigured}>
              {isSending ? "Thinking…" : "Ask Copilot"}
            </button>
          </form>
          <small className="copilot-disclaimer">Read-only answers. Copilot does not change records, approve documents, or contact customers.</small>
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
          <Link href={record.href}><strong>{record.label}</strong><span>{record.detail}</span></Link>
        </li>
      ))}
    </ul>
  );
}
