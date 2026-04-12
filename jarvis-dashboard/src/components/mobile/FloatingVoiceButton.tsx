"use client";

import { useState, useCallback, useRef } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface FloatingVoiceButtonProps {
  onTranscript: (transcript: string) => void;
}

export default function FloatingVoiceButton({ onTranscript }: FloatingVoiceButtonProps) {
  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef("");

  const appendTranscript = useCallback((text: string) => {
    const sep = transcriptRef.current && !transcriptRef.current.endsWith(" ") ? " " : "";
    transcriptRef.current += sep + text;
    setTranscript(transcriptRef.current);
  }, []);

  const { isListening, isSupported, interimText, toggleListening, stopListening } =
    useVoiceInput(appendTranscript);

  function handleTap() {
    if (isListening) {
      stopListening();
      if (transcriptRef.current.trim()) {
        onTranscript(transcriptRef.current.trim());
      }
      transcriptRef.current = "";
      setTranscript("");
    } else {
      transcriptRef.current = "";
      setTranscript("");
      toggleListening();
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(isListening ? [10, 50, 10] : 15);
    }
  }

  if (!isSupported) return null;

  return (
    <>
      {/* Overlay when recording */}
      {isListening && (
        <div className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-end" onClick={handleTap}>
          <div className="mb-6 px-6 text-center" style={{ paddingBottom: "calc(80px + 60px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="bg-jarvis-card/95 border border-jarvis-border rounded-2xl px-5 py-4 max-w-sm mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-[pulse-dot_1s_ease-in-out_infinite] tap-target-auto" />
                <span className="text-sm text-red-400 font-medium tap-target-auto">Listening...</span>
              </div>
              <p className="text-base text-jarvis-text leading-relaxed text-left tap-target-auto">
                {transcript || interimText || "Speak now..."}
                {transcript && interimText && <span className="text-jarvis-muted/50 italic"> {interimText}</span>}
              </p>
              <p className="text-xs text-jarvis-muted mt-3 tap-target-auto">Tap anywhere to send</p>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onTouchEnd={(e) => { e.preventDefault(); handleTap(); }}
        onClick={handleTap}
        className={`md:hidden fixed z-[56] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
          isListening
            ? "bg-red-500 voice-fab-listening"
            : "bg-jarvis-accent voice-fab hover:bg-jarvis-accent-hover"
        }`}
        style={{ bottom: "calc(68px + env(safe-area-inset-bottom, 0px))" }}
        aria-label={isListening ? "Stop recording" : "Voice input"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    </>
  );
}
