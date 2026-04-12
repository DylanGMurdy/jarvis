"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const C_SUITE = [
  { name: "CMO", title: "Chief Marketing Officer", icon: "📣", desc: "Market analysis, content strategy, growth channels, brand voice", color: "from-pink-500 to-rose-500" },
  { name: "CFO", title: "Chief Financial Officer", icon: "💰", desc: "Revenue models, unit economics, funding needs, financial risks", color: "from-green-500 to-emerald-500" },
  { name: "CTO", title: "Chief Technology Officer", icon: "⚙️", desc: "Tech stack, build roadmap, MVP scope, technical risks", color: "from-blue-500 to-cyan-500" },
  { name: "COO", title: "Chief Operating Officer", icon: "🎯", desc: "Operations plans, hiring roadmaps, process maps, KPIs", color: "from-orange-500 to-amber-500" },
  { name: "CLO", title: "Chief Legal Officer", icon: "⚖️", desc: "Legal risks, entity structure, contracts, compliance", color: "from-purple-500 to-violet-500" },
  { name: "CHRO", title: "Chief HR Officer", icon: "👥", desc: "Org structure, first hires, culture, compensation", color: "from-teal-500 to-cyan-500" },
];

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("Dylan");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [warRoomLoading, setWarRoomLoading] = useState(false);
  const [agentReveal, setAgentReveal] = useState(0);
  const [checkingComplete, setCheckingComplete] = useState(true);

  // Check if onboarding already complete — skip if so
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.data?.onboarding_complete === "true") {
          router.replace("/");
          return;
        }
        if (data.data?.profile_name) setName(data.data.profile_name);
      } catch { /* silent */ }
      setCheckingComplete(false);
    })();
  }, [router]);

  // Animate agent reveal on step 3
  useEffect(() => {
    if (step !== 3) return;
    setAgentReveal(0);
    const interval = setInterval(() => {
      setAgentReveal((prev) => {
        if (prev >= C_SUITE.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [step]);

  async function handleCreateIdea() {
    if (!ideaTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ideaTitle.trim(),
          description: ideaDescription.trim() || "Created during onboarding",
          category: "AI Business",
          status: "Idea",
          grade: "B",
          progress: 0,
          revenue_goal: "$1k MRR",
        }),
      });
      const data = await res.json();
      const project = data.data || data;
      if (project?.id) setCreatedProjectId(project.id);
      setStep(3);
    } catch { /* silent */ }
    setCreating(false);
  }

  async function handleDeployWarRoom() {
    if (!createdProjectId) {
      setStep(5);
      return;
    }
    setWarRoomLoading(true);
    try {
      // Fire and forget — War Room takes a while; we move on to the dashboard
      fetch(`/api/projects/${createdProjectId}/warroom/deploy`, { method: "POST" }).catch(() => {});
    } catch { /* silent */ }
    // Brief delay so the spinner is visible, then advance
    setTimeout(() => {
      setWarRoomLoading(false);
      setStep(5);
    }, 1200);
  }

  async function handleFinish() {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_complete: "true",
          profile_name: name,
        }),
      });
    } catch { /* silent */ }
    router.push("/");
  }

  if (checkingComplete) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#64748b] animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] flex flex-col">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#6366f1]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-6 py-4 border-b border-[#1e1e2e]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center text-white font-bold text-sm">J</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#64748b] font-semibold">Step {step} of 5</span>
              <button onClick={handleFinish} className="text-xs text-[#64748b] hover:text-[#e2e8f0] transition-colors">
                Skip setup
              </button>
            </div>
            <div className="h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6366f1] to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl animate-[slideUp_0.4s_ease-out]" key={step}>
          {/* ── Step 1: Welcome ───────────────────────── */}
          {step === 1 && (
            <div className="text-center">
              <div className="inline-flex w-20 h-20 bg-gradient-to-br from-[#6366f1] to-purple-500 rounded-2xl items-center justify-center text-white font-bold text-3xl mb-6 shadow-2xl shadow-[#6366f1]/30">
                J
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                Welcome to Jarvis
              </h1>
              <p className="text-base text-[#64748b] mb-8 max-w-md mx-auto">
                Your AI executive team is ready. Let&apos;s get you set up in 4 quick steps.
              </p>
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 max-w-sm mx-auto mb-6">
                <label className="block text-xs text-[#64748b] mb-2 text-left">What should Jarvis call you?</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-[#6366f1]"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="px-8 py-3 bg-gradient-to-r from-[#6366f1] to-purple-500 text-white rounded-xl text-base font-medium hover:shadow-lg hover:shadow-[#6366f1]/30 transition-all disabled:opacity-50"
              >
                Let&apos;s go &rarr;
              </button>
            </div>
          )}

          {/* ── Step 2: First idea ────────────────────── */}
          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">💡</div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  What&apos;s your first idea, {name}?
                </h1>
                <p className="text-sm text-[#64748b] max-w-md mx-auto">
                  Drop in any business idea you&apos;ve been thinking about. Jarvis will turn it into a project you can analyze.
                </p>
              </div>
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 mb-6">
                <label className="block text-xs text-[#64748b] mb-1.5">Idea title</label>
                <input
                  type="text"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  placeholder="e.g. AI lead nurture for home builders"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-base text-white placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] mb-4"
                  autoFocus
                />
                <label className="block text-xs text-[#64748b] mb-1.5">A few sentences (optional)</label>
                <textarea
                  value={ideaDescription}
                  onChange={(e) => setIdeaDescription(e.target.value)}
                  placeholder="What problem does it solve? Who's it for?"
                  rows={3}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-[#1e1e2e] text-[#e2e8f0] rounded-xl text-sm hover:bg-[#2e2e3e] transition-colors"
                >
                  &larr; Back
                </button>
                <button
                  onClick={handleCreateIdea}
                  disabled={!ideaTitle.trim() || creating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#6366f1] to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-[#6366f1]/30 transition-all disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create idea & continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Meet your team ────────────────── */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🤖</div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Meet your C-Suite
                </h1>
                <p className="text-sm text-[#64748b] max-w-md mx-auto">
                  Six AI executives ready to analyze every angle of your business.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {C_SUITE.map((agent, i) => (
                  <div
                    key={agent.name}
                    className={`bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 transition-all duration-500 ${
                      i < agentReveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center text-lg flex-shrink-0`}>
                        {agent.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{agent.name}</span>
                          <span className="text-[10px] text-[#64748b]">{agent.title}</span>
                        </div>
                        <p className="text-xs text-[#64748b] mt-1 line-clamp-2">{agent.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-[#1e1e2e] text-[#e2e8f0] rounded-xl text-sm hover:bg-[#2e2e3e] transition-colors"
                >
                  &larr; Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={agentReveal < C_SUITE.length}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#6366f1] to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-[#6366f1]/30 transition-all disabled:opacity-50"
                >
                  {agentReveal < C_SUITE.length ? "Loading..." : "I'm ready to deploy them →"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: First War Room ────────────────── */}
          {step === 4 && (
            <div className="text-center">
              <div className="text-5xl mb-4">⚡</div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Run your first War Room
              </h1>
              <p className="text-sm text-[#64748b] mb-8 max-w-md mx-auto">
                Deploy all 12 agents on{" "}
                <span className="text-[#6366f1] font-semibold">
                  &ldquo;{ideaTitle || "your idea"}&rdquo;
                </span>
                . They&apos;ll analyze it from every angle and give you a complete strategic breakdown.
              </p>
              <button
                onClick={handleDeployWarRoom}
                disabled={warRoomLoading}
                className="group relative inline-flex items-center justify-center px-12 py-5 bg-gradient-to-r from-[#6366f1] to-purple-500 text-white rounded-2xl text-lg font-bold hover:shadow-2xl hover:shadow-[#6366f1]/40 transition-all disabled:opacity-70 mb-4"
              >
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#6366f1] to-purple-500 blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  {warRoomLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deploying agents...
                    </>
                  ) : (
                    <>⚡ Deploy War Room</>
                  )}
                </span>
              </button>
              <div>
                <button
                  onClick={() => setStep(5)}
                  className="text-xs text-[#64748b] hover:text-[#e2e8f0] transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: You're ready ──────────────────── */}
          {step === 5 && (
            <div className="text-center">
              <div className="inline-flex w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl items-center justify-center text-white text-3xl mb-6 shadow-2xl shadow-green-500/30">
                ✓
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                You&apos;re ready, {name}.
              </h1>
              <p className="text-base text-[#64748b] mb-8 max-w-md mx-auto">
                Your dashboard is live. Here&apos;s what you can do next:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
                {[
                  { icon: "💡", title: "Ideas Lab", desc: "Manage all your business ideas in one place" },
                  { icon: "🤖", title: "Agents", desc: "Deploy individual agents for targeted analysis" },
                  { icon: "💬", title: "Chat", desc: "Talk to Jarvis directly for strategic guidance" },
                ].map((tip) => (
                  <div key={tip.title} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
                    <div className="text-2xl mb-2">{tip.icon}</div>
                    <div className="text-sm font-semibold text-white mb-1">{tip.title}</div>
                    <p className="text-xs text-[#64748b]">{tip.desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleFinish}
                className="px-8 py-3 bg-gradient-to-r from-[#6366f1] to-purple-500 text-white rounded-xl text-base font-medium hover:shadow-lg hover:shadow-[#6366f1]/30 transition-all"
              >
                Enter Jarvis →
              </button>
              <p className="text-[10px] text-[#64748b] mt-3">
                Tip: Press <kbd className="bg-[#1e1e2e] px-1.5 py-0.5 rounded font-mono">⌘K</kbd> anywhere to search
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
