"use client";

import { LanguageSelector } from "./LanguageSelector";
import type { WidgetLanguage } from "./types";

interface ChatHeaderProps {
  onMinimize: () => void;
  onClose: () => void;
  onClear: () => void;
  selectedLanguage: WidgetLanguage;
  onLanguageChange: (lang: WidgetLanguage) => void;
}

export function ChatHeader({
  onMinimize,
  onClose,
  onClear,
  selectedLanguage,
  onLanguageChange
}: ChatHeaderProps) {
  return (
    <header className="ai-chat-header">
      <div className="ai-header-left">
        <div className="ai-header-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
        </div>

        <div className="ai-header-title-block">
          <div className="ai-header-name-row">
            <h2 className="ai-header-name">Amiro Intelligence</h2>
            <div className="ai-header-status-pill" title="System online">
              <span className="ai-status-dot-pulse" />
              <span className="ai-status-text">Online</span>
            </div>
          </div>
          <p className="ai-header-subtitle">Your intelligent multilingual assistant</p>
        </div>
      </div>

      <div className="ai-header-controls">
        {/* Language selector */}
        <LanguageSelector
          selected={selectedLanguage}
          onSelect={onLanguageChange}
          compact
        />

        {/* Clear conversation */}
        <button
          type="button"
          className="ai-header-icon-btn"
          onClick={onClear}
          title="Reset / Clear conversation"
          aria-label="Clear conversation"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        {/* Minimize */}
        <button
          type="button"
          className="ai-header-icon-btn"
          onClick={onMinimize}
          title="Minimize chat"
          aria-label="Minimize chat"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Close */}
        <button
          type="button"
          className="ai-header-icon-btn close"
          onClick={onClose}
          title="Close chat"
          aria-label="Close chat"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </header>
  );
}

