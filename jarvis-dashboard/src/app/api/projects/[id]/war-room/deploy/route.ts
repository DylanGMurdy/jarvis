import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

interface AgentDef {
  key: string;
  name: string;
  role: string;
  prompt: string;
  tier: "c-suite" | "vp" | "specialist";
}

// Sleep helper
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Concise prompts (~200 tokens each) ──────────────────
const WAVE_1: AgentDef[] = [
  { key: "cfo", name: "CFO", role: "Chief Financial Officer", tier: "c-suite",
    prompt: "You are the CFO. Output 4 short sections: 1) Revenue Model, 2) Unit Economics (CAC/LTV/margin estimates), 3) Funding Need, 4) Top 3 Financial Risks. Bullets only. Under 250 words." },
  { key: "cto", name: "CTO", role: "Chief Technology Officer", tier: "c-suite",
    prompt: "You are the CTO. Output 4 short sections: 1) Tech Stack, 2) MVP Scope (3-5 features), 3) Build Timeline, 4) Top 3 Technical Risks. Bullets only. Under 250 words." },
  { key: "clo", name: "CLO", role: "Chief Legal Officer", tier: "c-suite",
    prompt: "You are the CLO. Output 4 short sections: 1) Entity Structure, 2) Top Legal Risks, 3) Contracts Needed, 4) Compliance Requirements. Bullets only. Under 250 words." },
  { key: "coo", name: "COO", role: "Chief Operations Officer", tier: "c-suite",
    prompt: "You are the COO. Output 4 short sections: 1) Operations Plan, 2) Key Processes, 3) Automate vs Hire, 4) Top 5 KPIs. Bullets only. Under 250 words." },
];

const WAVE_2: AgentDef[] = [
  { key: "cmo", name: "CMO", role: "Chief Marketing Officer", tier: "c-suite", prompt: "You are the CMO. Output: ICP, top 3 channels, content strategy, brand position. Bullets. Under 200 words." },
  { key: "chro", name: "CHRO", role: "Chief HR Officer", tier: "c-suite", prompt: "You are the CHRO. Output: org structure, first 3 hires/automations, culture values, comp approach. Bullets. Under 200 words." },
  { key: "cso", name: "CSO", role: "Chief Sales Officer", tier: "c-suite", prompt: "You are the CSO. Output: ICP, sales process, pricing, outreach approach. Bullets. Under 200 words." },
  { key: "vp_product", name: "VP Product", role: "VP of Product", tier: "vp", prompt: "You are the VP Product. Output: product vision, 3-phase roadmap, personas, differentiation. Bullets. Under 200 words." },
  { key: "vp_engineering", name: "VP Engineering", role: "VP of Engineering", tier: "vp", prompt: "You are the VP Engineering. Output: architecture, 4-week sprint plan, tech debt strategy, API design. Bullets. Under 200 words." },
  { key: "vp_finance", name: "VP Finance", role: "VP of Finance", tier: "vp", prompt: "You are the VP Finance. Output: 12-month revenue projection, cash flow, pricing, key investor metrics. Bullets. Under 200 words." },
  { key: "vp_sales", name: "VP Sales", role: "VP of Sales", tier: "vp", prompt: "You are the VP Sales. Output: pipeline structure, objection handling, demo script outline, close playbook. Bullets. Under 200 words." },
  { key: "vp_marketing", name: "VP Marketing", role: "VP of Marketing", tier: "vp", prompt: "You are the VP Marketing. Output: brand strategy, launch plan, budget split, 90-day campaigns. Bullets. Under 200 words." },
  { key: "vp_operations", name: "VP Operations", role: "VP of Operations", tier: "vp", prompt: "You are the VP Operations. Output: ops stack, SOP framework, vendor strategy, scaling plan. Bullets. Under 200 words." },
  { key: "head_of_growth", name: "Head of Growth", role: "Head of Growth", tier: "specialist", prompt: "You are the Head of Growth. Output: growth loops, channel ranking, retention strategy, first 5 experiments. Bullets. Under 200 words." },
  { key: "head_of_content", name: "Head of Content", role: "Head of Content", tier: "specialist", prompt: "You are the Head of Content. Output: content calendar, SEO strategy, content pillars, viral hooks. Bullets. Under 200 words." },
  { key: "head_of_design", name: "Head of Design", role: "Head of Design", tier: "specialist", prompt: "You are the Head of Design. Output: design system principles, brand assets, UX patterns, UI components. Bullets. Under 200 words." },
  { key: "data_analytics", name: "Data Analytics", role: "Head of Data Analytics", tier: "specialist", prompt: "You are the Head of Data Analytics. Output: north star metric, funnel metrics, dashboard design, data infra. Bullets. Under 200 words." },
  { key: "head_cx", name: "Head of CX", role: "Head of Customer Experience", tier: "specialist", prompt: "You are the Head of CX. Output: onboarding flow, support playbook, NPS program, voice-of-customer. Bullets. Under 200 words." },
  { key: "head_of_pr", name: "Head of PR", role: "Head of Public Relations", tier: "specialist", prompt: "You are the Head of PR. Output: press strategy, media targets, launch PR plan, thought leadership. Bullets. Under 200 words." },
  { key: "sdr", name: "SDR Lead", role: "SDR Team Lead", tier: "specialist", prompt: "You are the SDR Lead. Output: outreach sequences, qualification criteria, follow-up cadence, personalization. Bullets. Under 200 words." },
  { key: "partnerships", name: "Partnerships", role: "Head of Partnerships", tier: "specialist", prompt: "You are the Head of Partnerships. Output: partnership targets, pitch approach, affiliate program, integrations. Bullets. Under 200 words." },
  { key: "investor_relations", name: "Investor Relations", role: "Head of IR", tier: "specialist", prompt: "You are the Head of IR. Output: investor update template, pitch deck outline, cap table notes, fundraising timeline. Bullets. Under 200 words." },
  { key: "head_of_recruiting", name: "Head of Recruiting", role: "Head of Recruiting", tier: "specialist", prompt: "You are the Head of Recruiting. Output: job descriptions for first roles, hiring process, culture-fit questions, employer brand. Bullets. Under 200 words." },
  { key: "customer_success", name: "Customer Success", role: "Head of Customer Success", tier: "specialist", prompt: "You are the Head of CS. Output: onboarding playbook, health scoring, expansion triggers, churn prevention. Bullets. Under 200 words." },
];

// ─── Lean context (Wave 1: title + description ≤500 chars) ──
async function buildLeanContext(sb: NonNullable<ReturnType<typeof getSupabase>>, projectId: string): Promise<{ lean: string; full: string; title: string; description: string }> {
  try {
    const [projectRes, tasksRes, notesRes] = await Promise.all([
      sb.from("projects").select("*").eq("id", projectId).single(),
      sb.from("project_tasks").select("title, done").eq("project_id", projectId),
      sb.from("project_notes").select("content, source").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (!projectRes.data) return { lean: "No project data found.", full: "No project data found.", title: "", description: "" };
    const p = projectRes.data;
    const tasks = tasksRes.data || [];
    const notes = notesRes.data || [];
    const description = (p.description || "No description").slice(0, 500);
    const lean = `PROJECT: ${p.title}\nDESCRIPTION: ${description}`;
    const full = `PROJECT: ${p.title}\nCategory: ${p.category || "N/A"}\nStatus: ${p.status}\nGrade: ${p.grade}\nRevenue Goal: ${p.revenue_goal || "Not set"}\nProgress: ${p.progress}%\n\nDESCRIPTION:\n${p.description || "No description"}\n\nTASKS:\n${tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "None"}\n\nRECENT NOTES:\n${notes.map((n: { content: string }) => n.content).join("\n---\n") || "None"}`;
    return { lean, full, title: p.title, description };
  } catch {
    return { lean: "Error loading project context.", full: "Error loading project context.", title: "", description: "" };
  }
}

// ─── Call agent with retry on rate limit ─────────────────
async function callAgent(client: Anthropic, agent: AgentDef, context: string, briefing?: string): Promise<{ key: string; name: string; role: string; tier: string; result: string }> {
  const system = briefing
    ? `${agent.prompt}\n\nWAVE 1 BRIEFING (financial, technical, legal, operational reality):\n${briefing}`
    : agent.prompt;

  const doCall = async () => {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: `Analyze:\n\n${context}` }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";
  };

  try {
    const result = await doCall();
    return { key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result };
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const isRateLimit = e?.status === 429 || (e?.message || "").toLowerCase().includes("rate");
    if (isRateLimit) {
      // Exponential backoff: wait 10s then retry once
      await sleep(10000);
      try {
        const result = await doCall();
        return { key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result };
      } catch (err2: unknown) {
        const e2 = err2 as { message?: string };
        return { key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result: `[Rate limited after retry] ${e2?.message || "Unknown error"}` };
      }
    }
    return { key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result: `[Error] ${e?.message || "Unknown error"}` };
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });
  const { lean: leanContext, full: fullContext, title: projectTitle } = await buildLeanContext(sb, projectId);

  try {
    // ── Initial 3-second buffer to let any prior requests clear ──
    await sleep(3000);

    // ── Wave 1: staggered (CFO 0s, CTO 4s, CLO 8s, COO 12s) ──
    // Use lean context only (no full chat history) in Wave 1
    const wave1Promises: Promise<{ key: string; name: string; role: string; tier: string; result: string }>[] = [];
    for (let i = 0; i < WAVE_1.length; i++) {
      const agent = WAVE_1[i];
      // Schedule each agent with a delay
      const delay = i * 4000;
      wave1Promises.push(
        sleep(delay).then(() => callAgent(client, agent, leanContext))
      );
    }
    // Wait for ALL Wave 1 to complete before moving on
    const wave1Results = await Promise.all(wave1Promises);
    const briefing = wave1Results.map((r) => `## ${r.name}\n${r.result}`).join("\n\n---\n\n");

    // ── Buffer between waves ──
    await sleep(3000);

    // ── Wave 2: staggered (1.5s apart to avoid rate limits) ──
    // Wave 2 gets full context (including chat history/notes) + briefing
    const wave2Promises: Promise<{ key: string; name: string; role: string; tier: string; result: string }>[] = [];
    for (let i = 0; i < WAVE_2.length; i++) {
      const agent = WAVE_2[i];
      const delay = i * 1500;
      wave2Promises.push(
        sleep(delay).then(() => callAgent(client, agent, fullContext, briefing))
      );
    }
    const wave2Results = await Promise.all(wave2Promises);
    const allResults = [...wave1Results, ...wave2Results];

    // Save all to project_notes
    await sb.from("project_notes").insert(allResults.map((r) => ({
      project_id: projectId,
      content: `[War Room — ${r.name}]\n\n${r.result}`,
      source: `war_room_${r.key}`,
    })));

    // ── Buffer before summary ──
    await sleep(2000);

    // JARVIS Summary (with retry on rate limit)
    let summary = "Summary generation failed.";
    const doSummary = async () => {
      const summaryRes = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: "You are JARVIS, AI chief of staff. Synthesize 21 agent analyses into 3 sections:\n1. **What the team agreed on** (3-5 bullets)\n2. **Key conflicts flagged** (2-4 bullets)\n3. **Recommended next steps** (5 prioritized actions)\nUnder 350 words.",
        messages: [{ role: "user", content: allResults.map((r) => `## ${r.name}\n${r.result}`).join("\n\n---\n\n") }],
      });
      const summaryBlock = summaryRes.content.find((b) => b.type === "text");
      return summaryBlock && summaryBlock.type === "text" ? summaryBlock.text : "Summary generation failed.";
    };
    try {
      summary = await doSummary();
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 429) {
        await sleep(10000);
        try { summary = await doSummary(); } catch { /* keep default */ }
      }
    }

    await sb.from("project_notes").insert({ project_id: projectId, content: `[War Room — JARVIS Summary]\n\n${summary}`, source: "war_room_summary" });

    // Save session record for history tracking
    const confMatch = summary.match(/(?:confidence|score)[:\s]+(\d+)\s*\/\s*10/i);
    const confidenceScore = confMatch ? parseInt(confMatch[1], 10) : 0;
    await sb.from("war_room_sessions").insert({
      project_id: projectId,
      confidence_score: confidenceScore,
      agents_run: allResults.length,
      summary_text: summary,
      status: "complete",
    });

    // Real-time notification for War Room completion
    try {
      await sb.from("notifications").insert({
        title: "War Room Complete",
        body: `${projectTitle} — ${allResults.length} agents analyzed your idea. Confidence score: ${confidenceScore}/10. View results →`,
        type: "success",
        link: `/ideas/${projectId}`,
        read: false,
      });
    } catch { /* notification failure should not fail the war room */ }

    return Response.json({ ok: true, summary, agents: allResults.map((r) => ({ key: r.key, name: r.name, role: r.role, tier: r.tier, result: r.result })) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
