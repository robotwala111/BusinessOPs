import { useState, useRef, useCallback } from 'react';
import { WHISPER_LANGUAGES } from './useSpeechRecognition';

interface UseWhisperRecordingProps {
  language?: keyof typeof WHISPER_LANGUAGES;
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useWhisperRecording({
  language = 'auto',
  onTranscript,
  onError
}: UseWhisperRecordingProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Check support on mount
  useState(() => {
    const supported = 
      typeof window !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function';
    setIsSupported(supported);
  });

  const startRecording = useCallback(async () => {
    try {
      if (!isSupported) {
        onError?.('Audio recording is not supported in this browser');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Send to Whisper API
        setIsProcessing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          const languageCode = WHISPER_LANGUAGES[language];
          if (languageCode) {
            formData.append('language', languageCode);
          }

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Speech recognition failed');
          }

          const data = await response.json() as { transcript: string };
          onTranscript?.(data.transcript);
        } catch (error) {
          console.error('Transcription error:', error);
          onError?.(error instanceof Error ? error.message : 'Failed to transcribe audio');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to access microphone');
    }
  }, [isSupported, language, onTranscript, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    isSupported,
    startRecording,
    stopRecording,
    isBusy: isRecording || isProcessing
  };
}
