// Multilingual Voice & Speech Recognition Language Mapping

export interface SpeechLangInfo {
  tag: string;       // BCP-47 tag for SpeechRecognition & SpeechSynthesis (e.g., 'te-IN')
  code: string;      // ISO 639-1 code (e.g., 'te')
  name: string;      // Human-readable name
  nativeName: string;
}

export const SUPPORTED_SPEECH_LANGUAGES: Record<string, SpeechLangInfo> = {
  te: { tag: "te-IN", code: "te", name: "Telugu", nativeName: "తెలుగు" },
  ta: { tag: "ta-IN", code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  hi: { tag: "hi-IN", code: "hi", name: "Hindi", nativeName: "हिंदी" },
  kn: { tag: "kn-IN", code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  ml: { tag: "ml-IN", code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  mr: { tag: "mr-IN", code: "mr", name: "Marathi", nativeName: "मराठी" },
  bn: { tag: "bn-IN", code: "bn", name: "Bengali", nativeName: "বাংলা" },
  gu: { tag: "gu-IN", code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  ar: { tag: "ar-SA", code: "ar", name: "Arabic", nativeName: "العربية" },
  es: { tag: "es-ES", code: "es", name: "Spanish", nativeName: "Español" },
  en: { tag: "en-IN", code: "en", name: "English (India)", nativeName: "English" }
};

/**
 * Detect the predominant script / language of a text snippet for Text-to-Speech (TTS).
 */
export function detectTextSpeechLanguage(text: string): SpeechLangInfo {
  if (!text) return SUPPORTED_SPEECH_LANGUAGES.en;

  // Telugu Unicode block (0C00–0C7F)
  if (/[\u0C00-\u0C7F]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.te;

  // Tamil Unicode block (0B80–0BFF)
  if (/[\u0B80-\u0BFF]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.ta;

  // Malayalam Unicode block (0D00–0D7F)
  if (/[\u0D00-\u0D7F]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.ml;

  // Kannada Unicode block (0C80–0CFF)
  if (/[\u0C80-\u0CFF]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.kn;

  // Bengali Unicode block (0980–09FF)
  if (/[\u0980-\u09FF]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.bn;

  // Gujarati Unicode block (0A80–0AFF)
  if (/[\u0A80-\u0AFF]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.gu;

  // Arabic Unicode block (0600–06FF)
  if (/[\u0600-\u06FF]/.test(text)) return SUPPORTED_SPEECH_LANGUAGES.ar;

  // Devanagari block (Hindi / Marathi) (0900–097F)
  if (/[\u0900-\u097F]/.test(text)) {
    if (/\b(आहे|नाही|करा|झाले|होते|नमस्कार)\b/.test(text)) {
      return SUPPORTED_SPEECH_LANGUAGES.mr;
    }
    return SUPPORTED_SPEECH_LANGUAGES.hi;
  }

  // Spanish detection
  if (/[áéíóúñ¿¡]|\b(hola|gracias|facturas?|proyectos?)\b/i.test(text)) {
    return SUPPORTED_SPEECH_LANGUAGES.es;
  }

  // Fallback to English
  return SUPPORTED_SPEECH_LANGUAGES.en;
}

/**
 * Clean markdown and technical syntax so Text-to-Speech sounds completely natural.
 */
export function prepareTextForSpeech(content: string): string {
  if (!content) return "";

  return content
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // Remove inline code
    .replace(/`[^`]+`/g, " ")
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, " ")
    // Markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Replace Indian currency symbol with "rupees"
    .replace(/₹\s*([\d,]+(?:\.\d+)?)/g, "$1 rupees")
    // Remove markdown headers, bold, italics, bullets, blockquotes
    .replace(/[#*•_~>|]/g, " ")
    // Remove extra parentheses or bracket noise around IDs like (PRI-5130)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the best matching browser SpeechSynthesisVoice for a given language tag / code.
 */
export function findBestVoice(
  voices: SpeechSynthesisVoice[],
  target: SpeechLangInfo
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 1. Exact BCP-47 tag match (e.g. 'te-IN' === 'te-IN')
  const exact = voices.find(
    (v) => v.lang.replace(/_/g, "-").toLowerCase() === target.tag.toLowerCase()
  );
  if (exact) return exact;

  // 2. Prefix match (e.g. starts with 'te' or 'ta')
  const prefix = voices.find((v) =>
    v.lang.replace(/_/g, "-").toLowerCase().startsWith(target.code.toLowerCase())
  );
  if (prefix) return prefix;

  // 3. Name match (e.g. voice name contains 'Telugu', 'Tamil', 'Hindi')
  const byName = voices.find((v) =>
    v.name.toLowerCase().includes(target.name.toLowerCase())
  );
  if (byName) return byName;

  // 4. If target is English, select an Indian English or default voice
  if (target.code === "en") {
    const fallback =
      voices.find((v) => v.lang.toLowerCase().includes("in")) ||
      voices.find((v) => v.default) ||
      voices[0];
    return fallback || null;
  }

  // For non-English languages (Telugu, Tamil, Hindi, etc.):
  // If no matching voice object is found, returning null allows the browser
  // to synthesize the text using the utterance.lang BCP-47 tag with its native speech engine
  return null;
}
