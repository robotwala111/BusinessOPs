"use client";

import { useState } from "react";

interface FloatingChatLauncherProps {
  isOpen: boolean;
  hasUnread: boolean;
  onClick: () => void;
}

export function FloatingChatLauncher({
  isOpen,
  hasUnread,
  onClick
}: FloatingChatLauncherProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="ai-floating-launcher-wrapper">
      {/* Tooltip on hover (when not open) */}
      {!isOpen && isHovered && (
        <div className="ai-launcher-tooltip" role="tooltip">
          <span>Chat with AI Assistant</span>
          <div className="ai-tooltip-arrow" />
        </div>
      )}

      {/* Main Circular Button */}
      <button
        type="button"
        className={`ai-floating-launcher-btn ${isOpen ? "open" : ""}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={isOpen ? "Close AI chat" : "Chat with AI Assistant"}
        aria-expanded={isOpen}
      >
        {/* Subtle breathing ripple ring when idle */}
        {!isOpen && <span className="ai-launcher-pulse-ring" />}

        {/* AI Assistant Icon */}
        <span className="ai-launcher-icon-inner">
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ai-close-svg">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ai-spark-svg">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
          )}
        </span>

        {/* Unread notification indicator */}
        {!isOpen && hasUnread && (
          <span className="ai-launcher-unread-badge" aria-label="1 unread welcome message">
            1
          </span>
        )}
      </button>
    </div>
  );
}

