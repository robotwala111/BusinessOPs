"use client";

import type { WidgetLanguage } from "./types";

interface WelcomeScreenProps {
  onSelectSuggestion: (question: string) => void;
  disabled?: boolean;
  language?: WidgetLanguage;
}

const SUGGESTIONS_BY_LANG: Record<string, { heading: string; subtitle: string; caption: string; chips: Array<{ text: string; icon: string }> }> = {
  te: {
    heading: "నమస్కారం! స్వాగతం.",
    subtitle: "నేను మీ అమీరో AI అసిస్టెంట్‌ని. ఈరోజు నేను మీకు ఎలా సహాయపడగలను?",
    caption: "తెలుగులో వ్యాపార వివరాలు అడగండి (క్లయింట్లు, ప్రాజెక్టులు, ఇన్వాయిస్‌లు).",
    chips: [
      { text: "మీరు ఏ సేవలను అందిస్తున్నారు?", icon: "💼" },
      { text: "కంపెనీ గురించి వివరాలు చెప్పండి.", icon: "🏢" },
      { text: "నేను ఎలా ప్రారంభించాలి?", icon: "🚀" },
      { text: "నాకు సహాయం కావాలి.", icon: "💡" },
      { text: "బకాయి ఉన్న ఇన్వాయిస్‌లు చూపించు.", icon: "📑" },
      { text: "యాక్టివ్ ప్రాజెక్ట్‌లను వివరించండి.", icon: "📊" }
    ]
  },
  hi: {
    heading: "नमस्ते! स्वागत है।",
    subtitle: "मैं आपका अमीरू AI सहायक हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?",
    caption: "हिंदी में पूछें — क्लाइंट्स, प्रोजेक्ट्स, इनवॉइस, कोटेशन इत्यादि।",
    chips: [
      { text: "आप कौन सी सेवाएं प्रदान करते हैं?", icon: "💼" },
      { text: "अपनी कंपनी के बारे में बताएं।", icon: "🏢" },
      { text: "मैं शुरुआत कैसे करूँ?", icon: "🚀" },
      { text: "मुझे किसी चीज़ में मदद चाहिए।", icon: "💡" },
      { text: "बकाया इनवॉइस दिखाओ।", icon: "📑" },
      { text: "सक्रिय प्रोजेक्ट्स का सारांश बताएं।", icon: "📊" }
    ]
  },
  kn: {
    heading: "ನಮಸ್ಕಾರ! ಸುಸ್ವಾಗತ.",
    subtitle: "ನಾನು ನಿಮ್ಮ ಅಮಿರೋ AI ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
    caption: "ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ — ಗ್ರಾಹಕರು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು.",
    chips: [
      { text: "ನೀವು ಯಾವ ಸೇವೆಗಳನ್ನು ನೀಡುತ್ತೀರಿ?", icon: "💼" },
      { text: "ನಿಮ್ಮ ಕಂಪನಿಯ ಬಗ್ಗೆ ತಿಳಿಸಿ.", icon: "🏢" },
      { text: "ನಾನು ಹೇಗೆ ಪ್ರಾರಂಭಿಸುವುದು?", icon: "🚀" },
      { text: "ನನಗೆ ಸಹಾಯ ಬೇಕು.", icon: "💡" },
      { text: "ಬಾಕಿ ಉಳಿದ ಇನ್‌ವಾಯ್ಸ್‌ಗಳನ್ನು ತೋರಿಸಿ.", icon: "📑" },
      { text: "ಸಕ್ರಿಯ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳ ಸಾರಾಂಶ ನೀಡಿ.", icon: "📊" }
    ]
  },
  ta: {
    heading: "வணக்கம்! வருக.",
    subtitle: "நான் உங்கள் அமிரோ AI உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
    caption: "தமிழில் கேளுங்கள் — வாடிக்கையாளர்கள், திட்டப்பணிகள், இன்வாய்ஸ்கள்.",
    chips: [
      { text: "நீங்கள் என்ன சேவைகளை வழங்குகிறீர்கள்?", icon: "💼" },
      { text: "உங்கள் நிறுவனத்தைப் பற்றி கூறுங்கள்.", icon: "🏢" },
      { text: "நான் எவ்வாறு தொடங்குவது?", icon: "🚀" },
      { text: "எனக்கு உதவி தேவை.", icon: "💡" },
      { text: "நிலுவையில் உள்ள இன்வாய்ஸ்களைக் காட்டு.", icon: "📑" },
      { text: "செயலில் உள்ள திட்டங்களைச் சுருக்கமாகக் கூறுங்கள்.", icon: "📊" }
    ]
  },
  default: {
    heading: "Hello! Welcome.",
    subtitle: "I'm your Amiro AI assistant. How can I help you today?",
    caption: "Ask in English, Telugu, Hindi, Kannada, Tamil, or your native language.",
    chips: [
      { text: "What services do you offer?", icon: "💼" },
      { text: "Tell me about your company.", icon: "🏢" },
      { text: "How can I get started?", icon: "🚀" },
      { text: "I need help with something.", icon: "💡" },
      { text: "Show overdue invoices.", icon: "📑" },
      { text: "Summarize active projects.", icon: "📊" }
    ]
  }
};

export function WelcomeScreen({ onSelectSuggestion, disabled, language = "auto" }: WelcomeScreenProps) {
  const content = (language !== "auto" && SUGGESTIONS_BY_LANG[language]) ? SUGGESTIONS_BY_LANG[language] : SUGGESTIONS_BY_LANG.default;

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
        <h3>{content.heading}</h3>
        <p className="ai-welcome-subtitle">
          {content.subtitle}
        </p>
        <span className="ai-welcome-caption">
          {content.caption}
        </span>
      </div>

      <div className="ai-welcome-chips-container">
        <span className="ai-chips-heading">Suggested questions</span>
        <div className="ai-chips-grid">
          {content.chips.map((item) => (
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
