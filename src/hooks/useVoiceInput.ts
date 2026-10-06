/* ═══════════════════════════════════════════════════════════
   useVoiceInput — Real-time voice transcription
   ═══════════════════════════════════════════════════════════
   Uses the browser's built-in Web Speech API — same technology
   as iPhone keyboard mic and Google voice input. No API key,
   no cost, no external WebSocket required.

   Supported: Chrome, Edge, Safari 14.1+
   Not supported: Firefox (behind a flag), older browsers
   ═══════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState } from 'react';

/* ── Browser type declarations ──────────────────────────── */

declare global {
  class SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: any) => any) | null;
    onerror: ((this: SpeechRecognition, ev: any) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

/* ── Types ──────────────────────────────────────────────── */

export interface UseVoiceInputReturn {
  isRecording: boolean;
  liveTranscript: string;       // interim — words-so-far while speaking
  finalTranscript: string;      // accumulated confirmed sentences
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearTranscript: () => void;
}

/* ── Hook ───────────────────────────────────────────────── */

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording]         = useState(false);
  const [liveTranscript, setLiveTranscript]   = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError]                     = useState<string | null>(null);

  const finalRef      = useRef('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /* ── Start ── */
  const startRecording = useCallback(async () => {
    setError(null);

    // Check browser support
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError(
        'Your browser does not support speech recognition. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    // Request microphone permission upfront for a better UX
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access denied. Allow mic access in your browser settings and try again.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalRef.current = (finalRef.current + ' ' + result[0].transcript).trim();
          setFinalTranscript(finalRef.current);
          setLiveTranscript('');
        } else {
          interimText += result[0].transcript;
        }
      }
      if (interimText) {
        setLiveTranscript(interimText);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Allow mic access and try again.',
        'no-speech': 'No speech detected. Try speaking closer to your microphone.',
        'network': 'Network error during speech recognition. Check your connection.',
        'audio-capture': 'No microphone found. Ensure a mic is connected.',
        'aborted': '',  // User stopped — not an error
      };
      const msg = errorMessages[event.error];
      if (msg === undefined) {
        setError(`Speech recognition error: ${event.error}`);
      } else if (msg) {
        setError(msg);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setLiveTranscript('');
    };

    recognition.start();
  }, []);

  /* ── Stop ── */
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setLiveTranscript('');
  }, []);

  /* ── Clear ── */
  const clearTranscript = useCallback(() => {
    finalRef.current = '';
    setFinalTranscript('');
    setLiveTranscript('');
    setError(null);
  }, []);

  return {
    isRecording,
    liveTranscript,
    finalTranscript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}
