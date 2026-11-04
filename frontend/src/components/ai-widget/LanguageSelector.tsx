"use client";

import { useState, useRef, useEffect } from "react";
import { SUPPORTED_LANGUAGES, type WidgetLanguage } from "./types";

interface LanguageSelectorProps {
  selected: WidgetLanguage;
  onSelect: (lang: WidgetLanguage) => void;
  compact?: boolean;
}

export function LanguageSelector({ selected, onSelect, compact = false }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === selected) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="ai-language-selector-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`ai-lang-pill-btn ${compact ? "compact" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Change conversation language"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="ai-lang-pill-text">{current.nativeName}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="ai-lang-dropdown-menu" role="listbox" aria-label="Select language">
          <div className="ai-lang-dropdown-header">
            <span>Choose Language</span>
          </div>
          <div className="ai-lang-dropdown-list">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={lang.code === selected}
                className={`ai-lang-option ${lang.code === selected ? "selected" : ""}`}
                onClick={() => {
                  onSelect(lang.code);
                  setIsOpen(false);
                }}
              >
                <span className="ai-lang-native">{lang.nativeName}</span>
                <span className="ai-lang-english">{lang.name}</span>
                {lang.code === selected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ai-check-icon">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

