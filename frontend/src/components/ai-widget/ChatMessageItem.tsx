"use client";

import { useState } from "react";
import Link from "next/link";
import type { CopilotMessage, CopilotRecord } from "@/types/copilot";

interface ChatMessageItemProps {
  message: CopilotMessage;
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === "user";

  const timeFormatted = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = message.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = message.content.replace(/[#*•_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`ai-chat-bubble-row ${isUser ? "user" : "assistant"}`}>
      {!isUser && (
        <div className="ai-bubble-avatar" title="Amiro Intelligence">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
        </div>
      )}

      <div className="ai-bubble-wrapper">
        <div className="ai-bubble-content">
          <div className="ai-bubble-text">
            {formatMessageContent(message.content)}
          </div>

          {message.records && message.records.length > 0 && (
            <div className="ai-bubble-records">
              {message.records.map((rec) => (
                <Link
                  key={`${rec.entity}-${rec.id}`}
                  href={rec.href}
                  className="ai-record-badge-link"
                >
                  <span className="ai-rec-tag">{rec.entity}</span>
                  <strong className="ai-rec-label">{rec.label}</strong>
                  <span className="ai-rec-detail">{rec.detail}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="ai-bubble-footer">
          <span className="ai-bubble-time">{timeFormatted}</span>

          {!isUser && (
            <div className="ai-bubble-actions">
              <button
                type="button"
                className="ai-bubble-action-btn"
                onClick={handleCopy}
                title={copied ? "Copied to clipboard" : "Copy text"}
                aria-label={copied ? "Copied" : "Copy message"}
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600 }}>Copied</span>
                  </>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </button>

              {typeof window !== "undefined" && "speechSynthesis" in window && (
                <button
                  type="button"
                  className={`ai-bubble-action-btn ${isSpeaking ? "active-speaking" : ""}`}
                  onClick={handleSpeak}
                  title={isSpeaking ? "Stop listening" : "Read aloud (Text-to-speech)"}
                  aria-label={isSpeaking ? "Stop speech" : "Read message aloud"}
                >
                  {isSpeaking ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMessageContent(content: string) {
  // Simple, robust markdown line parser without external heavy libraries
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Heading ###
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="ai-markdown-h4">
              {formatInlineStyles(trimmed.replace(/^###\s+/, ""))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="ai-markdown-h3">
              {formatInlineStyles(trimmed.replace(/^##\s+/, ""))}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="ai-markdown-bullet">
              <span className="ai-bullet-dot">•</span>
              <span>{formatInlineStyles(trimmed.replace(/^[•\-*]\s+/, ""))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="ai-markdown-bullet numbered">
              <span className="ai-bullet-num">{numMatch[1]}.</span>
              <span>{formatInlineStyles(numMatch[2])}</span>
            </div>
          );
        }

        // Empty line
        if (trimmed === "") {
          return <div key={idx} className="ai-markdown-spacer" />;
        }

        // Regular paragraph line
        return (
          <p key={idx} className="ai-markdown-p">
            {formatInlineStyles(line)}
          </p>
        );
      })}
    </>
  );
}

function formatInlineStyles(text: string) {
  // Parses [Link](url), **bold**, *italic*, and `code`
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("[") && token.includes("](")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <Link
            key={match.index}
            href={linkMatch[2]}
            className="ai-markdown-link"
            style={{
              color: "#f59e0b",
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: "3px"
            }}
          >
            {linkMatch[1]}
          </Link>
        );
      } else {
        parts.push(token);
      }
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="ai-bold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="ai-italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="ai-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

