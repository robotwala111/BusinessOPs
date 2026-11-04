"use client";

interface WelcomeScreenProps {
  onSelectSuggestion: (question: string) => void;
  disabled?: boolean;
}

const PRIMARY_SUGGESTIONS = [
  { text: "What services do you offer?", icon: "💼" },
  { text: "Tell me about your company.", icon: "🏢" },
  { text: "How can I get started?", icon: "🚀" },
  { text: "I need help with something.", icon: "💡" },
  { text: "Show overdue invoices.", icon: "📑" },
  { text: "Summarize active projects.", icon: "📊" }
];

export function WelcomeScreen({ onSelectSuggestion, disabled }: WelcomeScreenProps) {
  return (
    <div className="ai-welcome-screen">
      <div className="ai-welcome-avatar-wrap">
        <div className="ai-welcome-avatar">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
        </div>
        <span className="ai-welcome-wave" role="img" aria-label="Waving hand">👋</span>
      </div>

      <div className="ai-welcome-text">
        <h3>Hello! Welcome.</h3>
        <p className="ai-welcome-subtitle">
          I&apos;m your <strong>Amiro AI assistant</strong>. How can I help you today?
        </p>
        <span className="ai-welcome-caption">
          Ask in English, Telugu, Hindi, Kannada, Tamil, or your native language.
        </span>
      </div>

      <div className="ai-welcome-chips-container">
        <span className="ai-chips-heading">Suggested questions</span>
        <div className="ai-chips-grid">
          {PRIMARY_SUGGESTIONS.map((item) => (
            <button
              key={item.text}
              type="button"
              className="ai-suggestion-chip"
              disabled={disabled}
              onClick={() => onSelectSuggestion(item.text)}
            >
              <span className="ai-chip-icon">{item.icon}</span>
              <span className="ai-chip-label">{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

