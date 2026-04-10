"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

const MicIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const SendIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

interface VoiceChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** "panel" = compact sidebar style, "full" = full-width style */
  variant?: "panel" | "full";
  /** Called with full transcript when voice input completes — triggers intelligent routing */
  onVoiceComplete?: (transcript: string) => void;
}

export default function VoiceChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask JARVIS...",
  variant = "panel",
  onVoiceComplete,
}: VoiceChatInputProps) {
  const usedVoiceRef = useRef(false);
  const valueRef = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { valueRef.current = value; }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxHeight = variant === "panel" ? 80 : 120;
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + "px";
  }, [value, variant]);

  const appendTranscript = useCallback(
    (text: string) => {
      usedVoiceRef.current = true;
      const current = valueRef.current;
      const separator = current && !current.endsWith(" ") ? " " : "";
      onChange(current + separator + text);
    },
    [onChange]
  );

  const { isListening, isSupported, interimText, toggleListening, stopListening } =
    useVoiceInput(appendTranscript);

  function handleSend() {
    if (isListening) stopListening();
    // If voice was used and onVoiceComplete is provided, route through voice pipeline
    if (usedVoiceRef.current && onVoiceComplete && valueRef.current.trim()) {
      onVoiceComplete(valueRef.current.trim());
      onChange("");
      usedVoiceRef.current = false;
    } else {
      onSend();
    }
    // Haptic feedback on send
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isPanel = variant === "panel";
  const hasContent = value.trim().length > 0;

  return (
    <div className="relative">
      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-[pulse-dot_1s_ease-in-out_infinite]" />
          <span className="text-xs text-red-400">Listening...</span>
          <span className="text-xs text-jarvis-muted ml-auto">Tap mic to stop</span>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Textarea with auto-grow */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            rows={1}
            className={`w-full border text-sm text-jarvis-text placeholder:text-jarvis-muted focus:outline-none focus:border-jarvis-accent transition-colors disabled:opacity-50 resize-none overflow-hidden ${
              isPanel
                ? "bg-jarvis-bg border-jarvis-border rounded-lg px-3 py-2"
                : "bg-jarvis-bg border-jarvis-border rounded-2xl px-4 py-2.5"
            }`}
            style={{ minHeight: isPanel ? "36px" : "40px" }}
          />
          {/* Interim text overlay */}
          {isListening && interimText && (
            <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
              <span className={`text-sm text-transparent ${isPanel ? "px-3" : "px-4"}`}>
                {value}
              </span>
              <span className="text-sm text-jarvis-muted/50 italic truncate">{interimText}</span>
            </div>
          )}
        </div>

        {/* Mic button */}
        {isSupported && (
          <button
            onTouchEnd={(e) => { e.preventDefault(); toggleListening(); }}
            onClick={toggleListening}
            disabled={disabled}
            className={`flex-shrink-0 flex items-center justify-center transition-all disabled:opacity-50 ${
              isPanel
                ? `w-9 h-9 rounded-lg text-sm ${isListening ? "bg-red-500 text-white animate-[pulse-dot_1s_ease-in-out_infinite]" : "bg-jarvis-border text-jarvis-muted hover:text-white hover:bg-jarvis-accent/30"}`
                : `w-10 h-10 rounded-full ${isListening ? "bg-red-500 text-white animate-[pulse-dot_1s_ease-in-out_infinite]" : "bg-jarvis-border text-jarvis-muted hover:text-white hover:bg-jarvis-accent/30"}`
            }`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            <MicIcon size={isPanel ? 16 : 18} />
          </button>
        )}

        {/* Send button — animated color transition */}
        <button
          onTouchEnd={(e) => { e.preventDefault(); handleSend(); }}
          onClick={handleSend}
          disabled={disabled || (!hasContent && !isListening)}
          className={`flex-shrink-0 flex items-center justify-center transition-all duration-200 disabled:opacity-30 active:scale-90 ${
            isPanel
              ? `w-9 h-9 rounded-lg ${hasContent ? "bg-jarvis-accent text-white" : "bg-jarvis-border text-jarvis-muted"}`
              : `w-10 h-10 rounded-full ${hasContent ? "bg-jarvis-accent text-white shadow-lg shadow-jarvis-accent/30" : "bg-jarvis-border text-jarvis-muted"}`
          }`}
        >
          <SendIcon size={isPanel ? 16 : 18} />
        </button>
      </div>

      {/* Browser not supported message */}
      {!isSupported && (
        <p className="text-xs text-jarvis-muted mt-1 px-1">Voice input requires Chrome or Safari</p>
      )}
    </div>
  );
}
