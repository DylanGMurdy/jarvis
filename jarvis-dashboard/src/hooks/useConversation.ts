"use client";

import { useState, useCallback, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";
import { api } from "@/lib/api";

interface UseConversationOptions {
  /** Load a specific conversation by ID */
  conversationId?: string | null;
  /** Load the latest global conversation on mount */
  loadLatest?: boolean;
  /** Project-scoped chat (uses project chat API instead) */
  projectId?: string;
}

export function useConversation(options: UseConversationOptions = {}) {
  const { conversationId: initialId, loadLatest = false, projectId } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialId || null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");

  // Load conversation on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (projectId) {
          // Load project chat
          const res = await fetch(`/api/projects/${projectId}/chat`);
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages(data.messages);
          }
        } else if (initialId) {
          // Load specific conversation by ID
          const data = await api.conversations.get(initialId);
          if (data.messages?.length > 0) {
            setMessages(data.messages);
          }
          if (data.conversation) {
            setTitle(data.conversation.title || "");
            setConversationId(data.conversation.id);
          }
        } else if (loadLatest) {
          // Load latest global conversation
          const data = await api.conversations.getLatestGlobal();
          if (data.messages?.length > 0) {
            setMessages(data.messages);
          }
          if (data.conversation) {
            setConversationId(data.conversation.id);
            setTitle(data.conversation.title || "");
          }
        }
      } catch { /* silent */ }
      setLoading(false);
      setLoaded(true);
    }
    load();
  }, [initialId, loadLatest, projectId]);

  const send = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim() || sending) return null;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setSending(true);

    try {
      if (projectId) {
        // Project chat
        const res = await fetch(`/api/projects/${projectId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updated }),
        });
        const data = await res.json();
        const assistantMsg: ChatMessage = { role: "assistant", content: data.response ?? "No response." };
        setMessages([...updated, assistantMsg]);
        return data.response;
      } else {
        // Global chat with conversation persistence
        const data = await api.conversations.send(updated, conversationId || undefined);
        const assistantMsg: ChatMessage = { role: "assistant", content: data.response };
        setMessages([...updated, assistantMsg]);

        // Store the conversation ID for future messages
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId);
        }

        return data.response;
      }
    } catch {
      const errorMsg: ChatMessage = { role: "assistant", content: "Connection error. Standing by, sir." };
      setMessages([...updated, errorMsg]);
      return null;
    } finally {
      setSending(false);
    }
  }, [messages, sending, conversationId, projectId]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setTitle("");
  }, []);

  return {
    messages,
    setMessages,
    conversationId,
    loading,
    sending,
    loaded,
    title,
    send,
    startNewChat,
  };
}
