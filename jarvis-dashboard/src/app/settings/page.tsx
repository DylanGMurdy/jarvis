"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────
type Settings = Record<string, string>;

const INTEGRATIONS = [
  { key: "anthropic", name: "Anthropic API", envVar: "ANTHROPIC_API_KEY", desc: "Powers all AI agents" },
  { key: "supabase", name: "Supabase", envVar: "NEXT_PUBLIC_SUPABASE_URL", desc: "Database & auth" },
  { key: "google_drive", name: "Google Drive", envVar: "GOOGLE_CLIENT_ID", desc: "Project file storage" },
  { key: "perplexity", name: "Perplexity", envVar: "PERPLEXITY_API_KEY", desc: "Real-time research" },
  { key: "twilio", name: "Twilio", envVar: "TWILIO_ACCOUNT_SID", desc: "SMS & voice" },
  { key: "gmail", name: "Gmail API", envVar: "GMAIL_CLIENT_ID", desc: "Email automation" },
];

const AGENTS = [
  "CMO", "CFO", "CTO", "COO", "CLO", "CHRO", "CSO",
  "VP Sales", "VP Product", "VP Engineering", "VP Marketing", "VP Finance", "VP Operations",
  "Head of Growth", "Head of Content", "Head of Design", "Head of CX", "Head of PR",
  "SDR", "Partnerships", "Data Analytics", "Customer Success",
];

// ── Helpers ───────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full py-2 group">
      <span className="text-sm text-[#e2e8f0]">{label}</span>
      <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? "bg-[#6366f1]" : "bg-[#1e1e2e]"}`}>
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<Record<string, boolean>>({});
  const [dangerConfirm, setDangerConfirm] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setSettings(data.data || {});
      } catch { /* silent */ }
      // Check integration status
      try {
        const res = await fetch("/api/settings/integrations");
        const data = await res.json();
        setIntegrationStatus(data.status || {});
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const updateSetting = useCallback((key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    setSaving(false);
  }, [settings]);

  const handleDangerAction = useCallback(async (action: string) => {
    if (dangerConfirm !== action) {
      setDangerConfirm(action);
      return;
    }
    try {
      await fetch("/api/settings/danger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch { /* silent */ }
    setDangerConfirm(null);
  }, [dangerConfirm]);

  // Parse toggle/agent settings
  const emailNotifs = settings.notifications_email !== "false";
  const notifFreq = settings.notifications_frequency || "realtime";
  const verbosity = settings.agent_verbosity || "concise";
  const disabledAgents = new Set((settings.disabled_agents || "").split(",").filter(Boolean));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#64748b] animate-pulse">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[#64748b] hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-sm text-[#64748b]">Configure your Jarvis system</p>
            </div>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              saved
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#6366f1] text-white hover:bg-[#5558e6] disabled:opacity-50"
            }`}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
          </button>
        </div>

        <div className="space-y-6">
          {/* ── Profile ──────────────────────────────────── */}
          <SectionCard title="Profile">
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#64748b] mb-1">Name</label>
                <input
                  type="text"
                  value={settings.profile_name || "Dylan Murdoch"}
                  onChange={(e) => updateSetting("profile_name", e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-1">Timezone</label>
                <select
                  value={settings.profile_timezone || "America/Denver"}
                  onChange={(e) => updateSetting("profile_timezone", e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                >
                  <option value="America/Denver">Salt Lake City (MT)</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/New_York">Eastern</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">Work hours start</label>
                  <input
                    type="time"
                    value={settings.work_hours_start || "09:00"}
                    onChange={(e) => updateSetting("work_hours_start", e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">Work hours end</label>
                  <input
                    type="time"
                    value={settings.work_hours_end || "17:30"}
                    onChange={(e) => updateSetting("work_hours_end", e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Notifications ────────────────────────────── */}
          <SectionCard title="Notifications">
            <div className="space-y-3">
              <Toggle
                checked={emailNotifs}
                onChange={(v) => updateSetting("notifications_email", String(v))}
                label="Email notifications"
              />
              <div>
                <label className="block text-xs text-[#64748b] mb-1">Notification frequency</label>
                <div className="flex gap-2">
                  {[
                    { key: "realtime", label: "Real-time" },
                    { key: "hourly", label: "Hourly digest" },
                    { key: "daily", label: "Daily digest" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => updateSetting("notifications_frequency", opt.key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                        notifFreq === opt.key
                          ? "bg-[#6366f1] text-white"
                          : "bg-[#0a0a0f] border border-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Agent Settings ───────────────────────────── */}
          <SectionCard title="Agent Settings">
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#64748b] mb-1">Default project context</label>
                <input
                  type="text"
                  value={settings.agent_default_project || ""}
                  onChange={(e) => updateSetting("agent_default_project", e.target.value)}
                  placeholder="e.g. Lindy Agent Business"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-1">Agent verbosity</label>
                <div className="flex gap-2">
                  {[
                    { key: "concise", label: "Concise", desc: "Short, actionable" },
                    { key: "detailed", label: "Detailed", desc: "Full analysis" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => updateSetting("agent_verbosity", opt.key)}
                      className={`flex-1 px-3 py-3 rounded-lg text-sm transition-all text-left ${
                        verbosity === opt.key
                          ? "bg-[#6366f1]/10 border border-[#6366f1]/50 text-[#6366f1]"
                          : "bg-[#0a0a0f] border border-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0]"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-2">Active agents</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AGENTS.map((agent) => {
                    const isActive = !disabledAgents.has(agent);
                    return (
                      <button
                        key={agent}
                        onClick={() => {
                          const next = new Set(disabledAgents);
                          if (isActive) next.add(agent); else next.delete(agent);
                          updateSetting("disabled_agents", Array.from(next).join(","));
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                          isActive
                            ? "bg-green-500/10 border border-green-500/30 text-green-400"
                            : "bg-[#0a0a0f] border border-[#1e1e2e] text-[#64748b]"
                        }`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? "bg-green-400" : "bg-[#64748b]"}`} />
                        {agent}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Integrations ─────────────────────────────── */}
          <SectionCard title="Integrations">
            <div className="space-y-3">
              {INTEGRATIONS.map((integ) => {
                const connected = integrationStatus[integ.key] ?? (integ.key === "anthropic" || integ.key === "supabase");
                return (
                  <div key={integ.key} className="flex items-center justify-between py-2 border-b border-[#1e1e2e] last:border-0">
                    <div>
                      <div className="text-sm text-[#e2e8f0] font-medium">{integ.name}</div>
                      <div className="text-xs text-[#64748b]">{integ.desc}</div>
                    </div>
                    {connected ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Connected
                      </span>
                    ) : (
                      <button className="flex items-center gap-1.5 text-xs text-[#64748b] bg-[#0a0a0f] border border-[#1e1e2e] px-2.5 py-1 rounded-full hover:text-[#e2e8f0] hover:border-[#6366f1] transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Setup
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Danger Zone ──────────────────────────────── */}
          <div className="bg-[#12121a] border border-red-500/20 rounded-xl p-6">
            <h2 className="text-base font-semibold text-red-400 mb-4">Danger Zone</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#e2e8f0]">Clear all notifications</div>
                  <div className="text-xs text-[#64748b]">Remove all notification history</div>
                </div>
                <button
                  onClick={() => handleDangerAction("clear_notifications")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dangerConfirm === "clear_notifications"
                      ? "bg-red-500 text-white"
                      : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                  }`}
                >
                  {dangerConfirm === "clear_notifications" ? "Confirm Clear" : "Clear"}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#e2e8f0]">Reset agent activity</div>
                  <div className="text-xs text-[#64748b]">Clear all agent-generated notes and results</div>
                </div>
                <button
                  onClick={() => handleDangerAction("reset_agents")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dangerConfirm === "reset_agents"
                      ? "bg-red-500 text-white"
                      : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                  }`}
                >
                  {dangerConfirm === "reset_agents" ? "Confirm Reset" : "Reset"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
