"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  interimText: string;
  toggleListening: () => void;
  stopListening: () => void;
}

export function useVoiceInput(
  onTranscript: (text: string) => void
): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const accumulatedRef = useRef("");

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setIsSupported(!!SR);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    accumulatedRef.current = "";
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      // When we get final text, append it to the input
      if (finalText && finalText !== accumulatedRef.current) {
        const newPart = finalText.slice(accumulatedRef.current.length);
        if (newPart.trim()) {
          onTranscript(newPart);
        }
        accumulatedRef.current = finalText;
      }

      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" is expected — user paused. Restart silently.
      if (event.error === "no-speech" || event.error === "aborted") return;
      stopListening();
    };

    recognition.onend = () => {
      // Continuous mode may stop on its own (browser timeout).
      // Restart if still supposed to be listening.
      if (recognitionRef.current) {
        try {
          accumulatedRef.current = "";
          recognition.start();
        } catch {
          stopListening();
        }
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      stopListening();
    }
  }, [isListening, onTranscript, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, interimText, toggleListening, stopListening };
}
