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

interface VoiceChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** "panel" = compact sidebar style, "full" = full-width style */
  variant?: "panel" | "full";
}

export default function VoiceChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask JARVIS...",
  variant = "panel",
}: VoiceChatInputProps) {
  const [sendDisabled] = useState(false);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const appendTranscript = useCallback(
    (text: string) => {
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
    onSend();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isPanel = variant === "panel";

  return (
    <div className="relative">
      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-[pulse-dot_1s_ease-in-out_infinite]" />
          <span className="text-xs text-red-400">Listening...</span>
          <span className="text-xs text-[#64748b] ml-auto">Click mic to stop or Send to submit</span>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Input with interim text overlay */}
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={`w-full border rounded-${isPanel ? "lg" : "xl"} text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-[#6366f1] transition-colors disabled:opacity-50 ${
              isPanel
                ? "bg-[#0a0a0f] border-[#1e1e2e] px-3 py-2"
                : "bg-[#0a0a0f] border-[#1e1e2e] px-4 py-2.5"
            }`}
          />
          {/* Interim text overlay */}
          {isListening && interimText && (
            <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
              <span className={`text-sm text-transparent ${isPanel ? "px-3" : "px-4"}`}>
                {value}
              </span>
              <span className="text-sm text-[#64748b]/50 italic truncate">{interimText}</span>
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
                ? `px-3 py-2 rounded-lg text-sm ${isListening ? "bg-red-500 text-white animate-[pulse-dot_1s_ease-in-out_infinite]" : "bg-[#1e1e2e] text-[#64748b] hover:text-white hover:bg-[#6366f1]/30"}`
                : `w-10 h-10 rounded-lg ${isListening ? "bg-red-500 text-white animate-[pulse-dot_1s_ease-in-out_infinite]" : "bg-[#1e1e2e] text-[#64748b] hover:text-white hover:bg-[#6366f1]/30"}`
            }`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            <MicIcon size={isPanel ? 16 : 18} />
          </button>
        )}

        {/* Send button */}
        <button
          onTouchEnd={(e) => { e.preventDefault(); handleSend(); }}
          onClick={handleSend}
          disabled={disabled || sendDisabled || (!value.trim() && !isListening)}
          className={`flex-shrink-0 text-white font-medium transition-colors disabled:opacity-50 ${
            isPanel
              ? "px-3 py-2 bg-[#6366f1] rounded-lg text-sm hover:bg-[#5558e6]"
              : "px-4 py-2.5 bg-[#6366f1] rounded-lg text-sm hover:bg-[#5558e6]"
          }`}
        >
          Send
        </button>
      </div>

      {/* Browser not supported message */}
      {!isSupported && (
        <p className="text-xs text-[#64748b] mt-1 px-1">Voice input requires Chrome or Safari</p>
      )}
    </div>
  );
}
