import type { CopilotMessage, CopilotRecord, CopilotConversation } from "@/types/copilot";

export type WidgetLanguage =
  | "auto"
  | "en"
  | "te"
  | "hi"
  | "kn"
  | "ta"
  | "ml"
  | "mr"
  | "bn"
  | "gu"
  | "ar";

export interface LanguageOption {
  code: WidgetLanguage;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "auto", name: "Auto-Detect", nativeName: "Auto 🌐" },
  { code: "en", name: "English", nativeName: "English" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "hi", name: "Hindi", nativeName: "हिंदी" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "ar", name: "Arabic", nativeName: "العربية" }
];

export interface ChatWidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  hasUnread: boolean;
  selectedLanguage: WidgetLanguage;
  messages: CopilotMessage[];
  isSending: boolean;
  error: string | null;
  activeConversation: CopilotConversation | null;
}

