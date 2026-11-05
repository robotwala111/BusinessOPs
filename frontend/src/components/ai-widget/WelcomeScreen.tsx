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
      { text: "క్లయింట్ వివరాలు నింపండి.", icon: "📝" },
      { text: "బకాయి ఉన్న ఇన్వాయిస్‌లు చూపించు.", icon: "📑" },
      { text: "యాక్టివ్ ప్రాజెక్ట్‌లను వివరించండి.", icon: "📊" },
      { text: "నాకు సహాయం కావాలి.", icon: "💡" }
    ]
  },
  hi: {
    heading: "नमस्ते! स्वागत है।",
    subtitle: "मैं आपका अमीरू AI सहायक हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?",
    caption: "हिंदी में पूछें — क्लाइंट्स, प्रोजेक्ट्स, इनवॉइस, कोटेशन इत्यादि।",
    chips: [
      { text: "आप कौन सी सेवाएं प्रदान करते हैं?", icon: "💼" },
      { text: "अपनी कंपनी के बारे में बताएं।", icon: "🏢" },
      { text: "क्लाइंट विवरण स्टेप-बाय-स्टेप भरें।", icon: "📝" },
      { text: "बकाया इनवॉइस दिखाओ।", icon: "📑" },
      { text: "सक्रिय प्रोजेक्ट्स का सारांश बताएं।", icon: "📊" },
      { text: "मुझे किसी चीज़ में मदद चाहिए।", icon: "💡" }
    ]
  },
  kn: {
    heading: "ನಮಸ್ಕಾರ! ಸುಸ್ವಾಗತ.",
    subtitle: "ನಾನು ನಿಮ್ಮ ಅಮಿರೋ AI ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
    caption: "ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ — ಗ್ರಾಹಕರು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು.",
    chips: [
      { text: "ನೀವು ಯಾವ ಸೇವೆಗಳನ್ನು ನೀಡುತ್ತೀರಿ?", icon: "💼" },
      { text: "ನಿಮ್ಮ ಕಂಪನಿಯ ಬಗ್ಗೆ ತಿಳಿಸಿ.", icon: "🏢" },
      { text: "ಕ್ಲೈಂಟ್ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ.", icon: "📝" },
      { text: "ಬಾಕಿ ಉಳಿದ ಇನ್‌ವಾಯ್ಸ್‌ಗಳನ್ನು ತೋರಿಸಿ.", icon: "📑" },
      { text: "ಸಕ್ರಿಯ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳ ಸಾರಾಂಶ ನೀಡಿ.", icon: "📊" },
      { text: "ನನಗೆ ಸಹಾಯ ಬೇಕು.", icon: "💡" }
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
      { text: "செயலில் உள்ள திட்டங்களைச் சுருக்கமாகக் கூறுங்கள்.", icon: "📊" },
      { text: "படிவத்தை தானாக நிரப்பு.", icon: "✨" }
    ]
  },
  ml: {
    heading: "നമസ്കാരം! സ്വാഗതം.",
    subtitle: "ഞാൻ നിങ്ങളുടെ അമിറോ AI അസിസ്റ്റന്റാണ്. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?",
    caption: "മലയാളത്തിൽ ബിസിനസ്സ് വിവരങ്ങൾ ചോദിക്കൂ (ക്ലയന്റുകൾ, പ്രോജക്റ്റുകൾ, ഇൻവോയ്സുകൾ).",
    chips: [
      { text: "നിങ്ങൾ എന്തൊക്കെ സേവനങ്ങളാണ് നൽകുന്നത്?", icon: "💼" },
      { text: "കമ്പനിയെക്കുറിച്ചുള്ള വിവരങ്ങൾ പറയൂ.", icon: "🏢" },
      { text: "ഞാൻ എങ്ങനെ ആരംഭിക്കണം?", icon: "🚀" },
      { text: "എനിക്ക് ഒരു സഹായം വേണം.", icon: "💡" },
      { text: "കുടിശ്ശികയുള്ള ഇൻവോയ്സുകൾ ഏതൊക്കെയാണ്?", icon: "📑" },
      { text: "സജീവ പ്രോജക്റ്റുകളുടെ വിവരങ്ങൾ നൽകുക.", icon: "📊" },
      { text: "ക്ലയന്റ് ഫോം ഓട്ടോ-ഫിൽ ചെയ്യുക.", icon: "✨" }
    ]
  },
  mr: {
    heading: "नमस्कार! स्वागत आहे.",
    subtitle: "मी तुमचा अमिरो AI सहाय्यक आहे. आज मी तुम्हाला कशी मदत करू शकतो?",
    caption: "मराठीत विचारा — क्लायंट, इनव्हॉइस, सक्रिय प्रोजेक्ट्स.",
    chips: [
      { text: "तुम्ही कोणत्या सेवा प्रदान करता?", icon: "💼" },
      { text: "तुमच्या कंपनीबद्दल सांगा.", icon: "🏢" },
      { text: "थकबाकी असलेले इनव्हॉइस दाखवा.", icon: "📑" },
      { text: "सक्रिय प्रोजेक्ट्सचा तपशील द्या.", icon: "📊" },
      { text: "क्लायंट फॉर्म ऑटो-फिल करा.", icon: "✨" }
    ]
  },
  bn: {
    heading: "নমস্কার! স্বাগতম।",
    subtitle: "আমি আপনার আমিরো এআই সহকারী। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
    caption: "বাংলায় জিজ্ঞাসা করুন — ক্লায়েন্ট, ইনভয়েস, প্রকল্প।",
    chips: [
      { text: "আপনারা কী কী পরিষেবা প্রদান করেন?", icon: "💼" },
      { text: "কোম্পানি সম্পর্কে বিস্তারিত বলুন।", icon: "🏢" },
      { text: "বকেয়া ইনভয়েসগুলি দেখান।", icon: "📑" },
      { text: "সক্রিয় প্রকল্পগুলোর বিবরণ দিন।", icon: "📊" },
      { text: "ক্লায়েন্ট ফর্ম অটো-ফিল করুন।", icon: "✨" }
    ]
  },
  gu: {
    heading: "નમસ્તે! સ્વાગત છે.",
    subtitle: "હું તમારો અમિરો AI સહાયક છું. આજે હું તમને કેવી રીતે મદદ કરી શકું?",
    caption: "ગુજરાતીમાં પૂછો — ક્લાયન્ટ્સ, ઇન્વૉઇસેસ, પ્રોજેક્ટ્સ.",
    chips: [
      { text: "તમે કઈ સેવાઓ પ્રદાન કરો છો?", icon: "💼" },
      { text: "કંપની વિશે વિગતો આપો.", icon: "🏢" },
      { text: "બાકી ઇન્વૉઇસેસ બતાવો.", icon: "📑" },
      { text: "સક્રિય પ્રોજેક્ટ્સની વિગતો આપો.", icon: "📊" },
      { text: "ક્લાયન્ટ ફોર્મ ઑટો-ફિલ કરો.", icon: "✨" }
    ]
  },
  ar: {
    heading: "مرحباً! أهلاً بك.",
    subtitle: "أنا مساعدك الذكي أميرو. كيف يمكنني مساعدتك اليوم؟",
    caption: "تحدث بالعربية — استفسر عن العملاء، الفواتير، والمشاريع.",
    chips: [
      { text: "ما هي الخدمات التي تقدمونها؟", icon: "💼" },
      { text: "أخبرني عن شركتكم.", icon: "🏢" },
      { text: "اعرض الفواتير المستحقة والمتأخرة.", icon: "📑" },
      { text: "ملخص المشاريع النشطة.", icon: "📊" },
      { text: "تعبئة نموذج العميل تلقائياً.", icon: "✨" }
    ]
  },
  default: {
    heading: "Hello! Welcome.",
    subtitle: "I'm your Amiro AI assistant. How can I help you today?",
    caption: "Ask in English, Malayalam, Tamil, Telugu, Hindi, Kannada, or your native language.",
    chips: [
      { text: "What services do you offer?", icon: "💼" },
      { text: "Tell me about your company.", icon: "🏢" },
      { text: "Help me fill client details step by step.", icon: "📝" },
      { text: "Show overdue invoices.", icon: "📑" },
      { text: "Summarize active projects.", icon: "📊" },
      { text: "How can I get started?", icon: "🚀" }
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
