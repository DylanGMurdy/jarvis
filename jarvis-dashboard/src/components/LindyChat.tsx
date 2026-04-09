"use client";

import { useState, useEffect, useRef } from "react";

interface LindyMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface LindyUpdate {
  summary: string;
  emails_handled: number;
  tasks_completed: number;
  flags: string[];
  created_at: string;
}

const STORAGE_KEY = "jarvis_lindy_chat";

function loadHistory(): LindyMessage[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveHistory(msgs: LindyMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

export default function LindyChat() {
  const [messages, setMessages] = useState<LindyMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<LindyUpdate | null>(null);
  const [instruction, setInstruction] = useState("");
  const [instructStatus, setInstructStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
    fetch("/api/lindy")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(false));
    fetch("/api/lindy/update")
      .then((r) => r.json())
      .then((d) => { if (d.latest) setLatestUpdate(d.latest); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendChat(text?: string) {
    const msg = text || input.trim();
    if (!msg) return;
    const userMsg: LindyMessage = { role: "user", content: msg, timestamp: new Date().toISOString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    saveHistory(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/lindy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const assistantMsg: LindyMessage = { role: "assistant", content: data.response, timestamp: new Date().toISOString() };
      const withReply = [...updated, assistantMsg];
      setMessages(withReply);
      saveHistory(withReply);
    } catch {
      const errMsg: LindyMessage = { role: "assistant", content: "Failed to reach Lindy.", timestamp: new Date().toISOString() };
      setMessages([...updated, errMsg]);
      saveHistory([...updated, errMsg]);
    }
    setLoading(false);
  }

  async function sendInstruction() {
    if (!instruction.trim()) return;
    setInstructStatus("Sending...");
    try {
      const res = await fetch("/api/lindy/instruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() }),
      });
      const data = await res.json();
      setInstructStatus(data.message || "Sent");
      setInstruction("");
      setTimeout(() => setInstructStatus(null), 3000);
    } catch {
      setInstructStatus("Failed to send");
      setTimeout(() => setInstructStatus(null), 3000);
    }
  }

  // Active tab: "status" or "chat"
  const [tab, setTab] = useState<"status" | "chat">("status");

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl flex flex-col h-[440px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">L</span>
            <h3 className="text-sm font-semibold text-white">Lindy Operations</h3>
            {configured === true && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-[pulse-dot_2s_ease-in-out_infinite]" />
            )}
          </div>
          {tab === "chat" && messages.length > 0 && (
            <button onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY); }} className="text-[10px] text-[#64748b]/50 hover:text-[#64748b]">Clear</button>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab("status")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "status" ? "bg-purple-500/20 text-purple-400" : "text-[#64748b] hover:text-[#e2e8f0]"}`}>Status</button>
          <button onClick={() => setTab("chat")} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === "chat" ? "bg-purple-500/20 text-purple-400" : "text-[#64748b] hover:text-[#e2e8f0]"}`}>Chat</button>
        </div>
      </div>

      {tab === "status" ? (
        /* ── Status Tab ──────────────────────────────────── */
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Latest Update */}
          {latestUpdate ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#64748b] font-semibold uppercase">Last Update</span>
                <span className="text-[10px] text-[#64748b]">{new Date(latestUpdate.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-[#e2e8f0] whitespace-pre-wrap">{latestUpdate.summary}</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#64748b]">Emails:</span>
                  <span className="text-xs font-semibold text-white">{latestUpdate.emails_handled}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#64748b]">Tasks:</span>
                  <span className="text-xs font-semibold text-white">{latestUpdate.tasks_completed}</span>
                </div>
              </div>
              {latestUpdate.flags.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-[#eab308] font-semibold uppercase">Flags</span>
                  {latestUpdate.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-[#eab308]/10 border border-[#eab308]/20 rounded-lg">
                      <span className="text-[#eab308] text-xs mt-0.5">⚠</span>
                      <span className="text-xs text-[#eab308]">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-[#64748b]">No updates from Lindy yet</p>
              <p className="text-xs text-[#64748b]/60 mt-1">Point Lindy&apos;s webhook to POST /api/lindy/update</p>
            </div>
          )}

          {/* Instruct Lindy */}
          <div className="pt-3 border-t border-[#1e1e2e]">
            <span className="text-[10px] text-[#64748b] font-semibold uppercase">Send Instruction to Lindy</span>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInstruction()}
                placeholder="e.g. Follow up with all cold leads today"
                className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-purple-500/50"
              />
              <button
                onClick={sendInstruction}
                disabled={!instruction.trim()}
                className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-semibold hover:bg-purple-500/30 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                Send to Lindy
              </button>
            </div>
            {instructStatus && (
              <p className="text-[10px] text-purple-400 mt-1">{instructStatus}</p>
            )}
          </div>
        </div>
      ) : (
        /* ── Chat Tab ────────────────────────────────────── */
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-[#64748b]">
                  {configured === false ? "Add Lindy credentials to .env.local" : "Chat with your Lindy agent"}
                </p>
                {configured !== false && (
                  <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                    {["What did you handle today?", "Give me a status report", "Any urgent items?", "Summarize my inbox"].map((p, i) => (
                      <button key={i} onClick={() => sendChat(p)} className="text-[11px] px-2 py-1 rounded-lg bg-[#1e1e2e] text-[#64748b] hover:text-purple-400 hover:bg-purple-500/10 transition-colors">
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${msg.role === "user" ? "bg-purple-500/20 text-purple-200" : "bg-[#1e1e2e] text-[#e2e8f0]"}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-[9px] text-[#64748b] mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-[#64748b]">Thinking...</div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="px-4 py-3 border-t border-[#1e1e2e] flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Message Lindy..."
                className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:border-purple-500/50"
              />
              <button onClick={() => sendChat()} disabled={loading || !input.trim()} className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors disabled:opacity-40">
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
