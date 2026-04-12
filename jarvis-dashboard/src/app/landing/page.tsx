"use client";

import { useState } from "react";

const AGENTS = [
  { abbr: "CMO", title: "Chief Marketing Officer", desc: "Market analysis, content strategy, growth channels, and brand positioning.", color: "from-pink-500/20 to-rose-500/20", border: "border-pink-500/30", badge: "bg-pink-500/20 text-pink-400" },
  { abbr: "CFO", title: "Chief Financial Officer", desc: "Revenue models, unit economics, funding analysis, and financial risk assessment.", color: "from-emerald-500/20 to-teal-500/20", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-400" },
  { abbr: "CTO", title: "Chief Technology Officer", desc: "Architecture planning, tech stack selection, sprint plans, and API design.", color: "from-orange-500/20 to-amber-500/20", border: "border-orange-500/30", badge: "bg-orange-500/20 text-orange-400" },
  { abbr: "COO", title: "Chief Operating Officer", desc: "Operations plans, hiring roadmaps, process mapping, and KPI frameworks.", color: "from-sky-500/20 to-blue-500/20", border: "border-sky-500/30", badge: "bg-sky-500/20 text-sky-400" },
  { abbr: "CLO", title: "Chief Legal Officer", desc: "Legal risk assessment, entity structure, contract needs, and compliance.", color: "from-violet-500/20 to-purple-500/20", border: "border-violet-500/30", badge: "bg-violet-500/20 text-violet-400" },
  { abbr: "CHRO", title: "Chief HR Officer", desc: "Org structure, hiring plans, culture frameworks, and compensation models.", color: "from-cyan-500/20 to-teal-500/20", border: "border-cyan-500/30", badge: "bg-cyan-500/20 text-cyan-400" },
];

const STEPS = [
  { icon: "💡", title: "Idea Lab", desc: "Drop in a business idea. Describe it in plain English. JARVIS captures everything and builds a project around it." },
  { icon: "⚔️", title: "War Room", desc: "21 AI agents analyze your idea simultaneously. Two waves: C-suite first, then VPs and specialists, all briefed on each other's findings." },
  { icon: "🚀", title: "Build Pipeline", desc: "Agents generate sprint plans, financial models, legal checklists, and marketing strategies. You go from idea to execution in hours, not months." },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleJoinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setMessage(data.message || "You're on the waitlist!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong");
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-[#1e1e2e]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center text-white text-sm font-bold">J</div>
            <span className="text-lg font-bold tracking-tight">JARVIS</span>
          </div>
          <a href="#waitlist" className="px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#5558e6] transition-colors">
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/20 text-sm text-[#6366f1] mb-8">
            <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" />
            Now accepting early access applications
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Your personal AI
            <br />
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">private equity firm</span>
          </h1>
          <p className="text-lg sm:text-xl text-[#94a3b8] max-w-2xl mx-auto mb-10 leading-relaxed">
            One person. 21 AI agents. A full executive team working 24/7.
            <br className="hidden sm:block" />
            Turn any business idea into a funded, built, launched company.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#waitlist" className="px-8 py-4 bg-[#6366f1] text-white text-lg font-semibold rounded-xl hover:bg-[#5558e6] transition-all hover:shadow-lg hover:shadow-[#6366f1]/25">
              Join the Waitlist
            </a>
            <a href="#how-it-works" className="px-8 py-4 text-[#94a3b8] text-lg font-medium rounded-xl hover:text-white transition-colors">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="py-8 border-y border-[#1e1e2e]">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-center">
          <div><p className="text-2xl font-bold text-white">21</p><p className="text-xs text-[#64748b]">AI Agents</p></div>
          <div><p className="text-2xl font-bold text-white">8</p><p className="text-xs text-[#64748b]">C-Suite Roles</p></div>
          <div><p className="text-2xl font-bold text-white">60s</p><p className="text-xs text-[#64748b]">Full Analysis</p></div>
          <div><p className="text-2xl font-bold text-white">24/7</p><p className="text-xs text-[#64748b]">Always On</p></div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">From idea to execution in three steps</h2>
            <p className="text-[#94a3b8] text-lg">No MBA required. No co-founder needed. Just you and your AI executive team.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-8 hover:border-[#6366f1]/30 transition-all">
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-[#6366f1] rounded-full flex items-center justify-center text-white text-sm font-bold">{i + 1}</div>
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-[#94a3b8] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Team */}
      <section className="py-20 px-6 bg-[#08080d]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Meet your executive team</h2>
            <p className="text-[#94a3b8] text-lg">Each agent is a specialist. Together, they cover every aspect of building a business.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((agent) => (
              <div key={agent.abbr} className={`bg-gradient-to-br ${agent.color} rounded-2xl border ${agent.border} p-6 hover:scale-[1.02] transition-transform`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${agent.badge}`}>{agent.abbr}</span>
                  <h3 className="text-sm font-bold text-white">{agent.title}</h3>
                </div>
                <p className="text-sm text-[#94a3b8] leading-relaxed">{agent.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[#64748b] mt-8">+ 15 more specialists: VP Sales, VP Product, VP Engineering, Head of Growth, Head of Content, Investor Relations, and more.</p>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple pricing</h2>
            <p className="text-[#94a3b8] text-lg">Start building today. Scale when you're ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Founder */}
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-8 hover:border-[#6366f1]/30 transition-all">
              <h3 className="text-lg font-bold mb-1">Founder</h3>
              <p className="text-sm text-[#64748b] mb-4">Perfect for validating your first idea</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-[#64748b]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["1 active business", "All 21 AI agents", "War Room with full analysis", "Unlimited agent runs", "Project notes & history", "PDF report generation"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#94a3b8]">
                    <svg className="w-4 h-4 text-[#6366f1] shrink-0" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#waitlist" className="block w-full px-4 py-3 text-center border border-[#6366f1] text-[#6366f1] rounded-xl text-sm font-semibold hover:bg-[#6366f1]/10 transition-colors">
                Join Waitlist
              </a>
            </div>
            {/* Empire */}
            <div className="bg-gradient-to-b from-[#6366f1]/10 to-[#12121a] rounded-2xl border border-[#6366f1]/40 p-8 relative">
              <div className="absolute -top-3 right-6 px-3 py-1 bg-[#6366f1] text-white text-xs font-bold rounded-full">POPULAR</div>
              <h3 className="text-lg font-bold mb-1">Empire</h3>
              <p className="text-sm text-[#64748b] mb-4">For builders running multiple businesses</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$299</span>
                <span className="text-[#64748b]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["Unlimited businesses", "All 21 AI agents", "Priority agent processing", "War Room with refresh", "Cross-business orchestrator", "PDF reports + Supabase storage", "API access (coming soon)"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#94a3b8]">
                    <svg className="w-4 h-4 text-[#6366f1] shrink-0" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#waitlist" className="block w-full px-4 py-3 text-center bg-[#6366f1] text-white rounded-xl text-sm font-semibold hover:bg-[#5558e6] transition-colors">
                Join Waitlist
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="py-20 px-6 bg-[#08080d]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Get early access</h2>
          <p className="text-[#94a3b8] text-lg mb-8">Join the waitlist and be first to build with your AI executive team.</p>
          <form onSubmit={handleJoinWaitlist} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="flex-1 bg-[#12121a] border border-[#1e1e2e] rounded-xl px-5 py-4 text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] text-base"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-8 py-4 bg-[#6366f1] text-white rounded-xl text-base font-semibold hover:bg-[#5558e6] disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {status === "loading" ? "Joining..." : "Join Waitlist"}
            </button>
          </form>
          {status === "success" && (
            <p className="mt-4 text-sm text-[#22c55e]">{message}</p>
          )}
          {status === "error" && (
            <p className="mt-4 text-sm text-[#ef4444]">{message}</p>
          )}
          <p className="mt-6 text-xs text-[#64748b]">No spam. We'll only email you when it's time to build.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#1e1e2e]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#6366f1] rounded-md flex items-center justify-center text-white text-[10px] font-bold">J</div>
            <span className="text-sm font-semibold">JARVIS</span>
          </div>
          <p className="text-xs text-[#64748b]">&copy; {new Date().getFullYear()} JARVIS. Built by Dylan Murdoch.</p>
        </div>
      </footer>
    </div>
  );
}
