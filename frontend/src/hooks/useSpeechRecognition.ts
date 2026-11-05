import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionProps {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({
  language = 'en-IN',
  continuous = false,
  interimResults = true,
  onResult,
  onError
}: UseSpeechRecognitionProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + ' ';
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        const fullTranscript = finalTranscript || interimTranscript;
        setTranscript(fullTranscript);
        onResult?.(fullTranscript, !!finalTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        onError?.(event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [language, continuous, interimResults, onResult, onError]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript
  };
}

// Language mapping for Web Speech API (Browser native)
export const SPEECH_LANGUAGES = {
  auto: 'en-IN',
  en: 'en-IN',      // English (India)
  hi: 'hi-IN',      // Hindi
  te: 'te-IN',      // Telugu
  ta: 'ta-IN',      // Tamil
  ml: 'ml-IN',      // Malayalam
  kn: 'kn-IN',      // Kannada
  mr: 'mr-IN',      // Marathi
  bn: 'bn-IN',      // Bengali
  gu: 'gu-IN',      // Gujarati
  ar: 'ar-SA',      // Arabic
  es: 'es-ES'       // Spanish
} as const;

// Language codes for Whisper API
export const WHISPER_LANGUAGES = {
  auto: undefined,  // Auto-detect
  en: 'en',
  hi: 'hi',
  te: 'te',
  ta: 'ta',
  ml: 'ml',
  kn: 'kn',
  mr: 'mr',
  bn: 'bn',
  gu: 'gu',
  ar: 'ar',
  es: 'es'
} as const;
