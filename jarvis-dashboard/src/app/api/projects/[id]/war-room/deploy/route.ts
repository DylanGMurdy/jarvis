import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

// ─── Agent Definitions ───────────────────────────────────────
// Wave 1: Foundation (CFO, CTO, CLO, COO) — runs first to build the briefing
// Wave 2: Everyone else — gets the briefing as context

interface AgentDef {
  key: string;
  name: string;
  role: string;
  prompt: string;
  tier: "c-suite" | "vp" | "specialist";
}

const WAVE_1: AgentDef[] = [
  { key: "cfo", name: "CFO", role: "Chief Financial Officer", tier: "c-suite",
    prompt: "You are the CFO. Analyze this project's financial viability. Cover: revenue model, unit economics (CAC, LTV, margins), funding/bootstrap requirements, and top 3 financial risks. Be specific with numbers where possible. Keep it under 500 words." },
  { key: "cto", name: "CTO", role: "Chief Technology Officer", tier: "c-suite",
    prompt: "You are the CTO. Analyze this project's technical strategy. Cover: recommended tech stack with justifications, MVP scope (3-5 must-have features), build timeline (phased), and top 3 technical risks. Keep it under 500 words." },
  { key: "clo", name: "CLO", role: "Chief Legal Officer", tier: "c-suite",
    prompt: "You are the CLO. Analyze this project's legal landscape. Cover: recommended entity structure, top legal risks (IP, liability, compliance), contracts needed before launch, and regulatory requirements for this industry. Keep it under 500 words." },
  { key: "coo", name: "COO", role: "Chief Operations Officer", tier: "c-suite",
    prompt: "You are the COO. Analyze this project's operational requirements. Cover: day-to-day operations plan, key processes to build, what to automate vs. hire for, and 5 KPIs to track from day one. Keep it under 500 words." },
];

const WAVE_2: AgentDef[] = [
  { key: "cmo", name: "CMO", role: "Chief Marketing Officer", tier: "c-suite",
    prompt: "You are the CMO. Build the go-to-market strategy. Cover: target customer profile, top 3 acquisition channels, content strategy, and brand positioning. Keep it under 400 words." },
  { key: "chro", name: "CHRO", role: "Chief HR Officer", tier: "c-suite",
    prompt: "You are the CHRO. Design the people strategy. Cover: optimal org structure for current stage, first 3 hires/automations, core culture values, and compensation approach. Keep it under 400 words." },
  { key: "cso", name: "CSO", role: "Chief Sales Officer", tier: "c-suite",
    prompt: "You are the CSO. Build the sales strategy. Cover: ideal customer profile, sales process stages, pricing strategy, and outreach approach. Keep it under 400 words." },
  { key: "vp_product", name: "VP Product", role: "VP of Product", tier: "vp",
    prompt: "You are the VP of Product. Define the product strategy. Cover: product vision, feature roadmap (3 phases), user personas, and competitive differentiation. Keep it under 400 words." },
  { key: "vp_engineering", name: "VP Engineering", role: "VP of Engineering", tier: "vp",
    prompt: "You are the VP of Engineering. Plan the technical execution. Cover: architecture approach, sprint plan for first 4 weeks, tech debt prevention strategy, and API design principles. Keep it under 400 words." },
  { key: "vp_finance", name: "VP Finance", role: "VP of Finance", tier: "vp",
    prompt: "You are the VP of Finance. Build the financial model. Cover: 12-month revenue projection, cash flow forecast, pricing optimization, and key investor metrics to track. Keep it under 400 words." },
  { key: "vp_sales", name: "VP Sales", role: "VP of Sales", tier: "vp",
    prompt: "You are the VP of Sales. Design the sales machine. Cover: pipeline structure, objection handling framework, demo script outline, and closing playbook. Keep it under 400 words." },
  { key: "vp_marketing", name: "VP Marketing", role: "VP of Marketing", tier: "vp",
    prompt: "You are the VP of Marketing. Plan the marketing execution. Cover: brand strategy, launch plan, marketing budget allocation, and campaign ideas for first 90 days. Keep it under 400 words." },
  { key: "vp_operations", name: "VP Operations", role: "VP of Operations", tier: "vp",
    prompt: "You are the VP of Operations. Plan operational execution. Cover: operations tech stack, SOP framework, vendor strategy, and scaling plan. Keep it under 400 words." },
  { key: "head_of_growth", name: "Head of Growth", role: "Head of Growth", tier: "specialist",
    prompt: "You are the Head of Growth. Design the growth engine. Cover: growth loops, acquisition channel ranking, retention strategy, and first 5 experiments to run. Keep it under 400 words." },
  { key: "head_of_content", name: "Head of Content", role: "Head of Content", tier: "specialist",
    prompt: "You are the Head of Content. Build the content strategy. Cover: content calendar framework, SEO strategy, content pillars, and viral hook ideas. Keep it under 400 words." },
  { key: "head_of_design", name: "Head of Design", role: "Head of Design", tier: "specialist",
    prompt: "You are the Head of Design. Define the design direction. Cover: design system principles, brand asset priorities, UX patterns, and UI component strategy. Keep it under 400 words." },
  { key: "data_analytics", name: "Data Analytics", role: "Head of Data Analytics", tier: "specialist",
    prompt: "You are the Head of Data Analytics. Build the measurement framework. Cover: north star metric, key funnel metrics, analytics dashboard design, and data infrastructure recommendations. Keep it under 400 words." },
  { key: "head_cx", name: "Head of CX", role: "Head of Customer Experience", tier: "specialist",
    prompt: "You are the Head of CX. Design the customer experience. Cover: onboarding flow, support playbook, NPS program, and voice-of-customer strategy. Keep it under 400 words." },
  { key: "head_of_pr", name: "Head of PR", role: "Head of Public Relations", tier: "specialist",
    prompt: "You are the Head of PR. Build the PR strategy. Cover: press strategy, media targets, launch PR plan, and thought leadership positioning. Keep it under 400 words." },
  { key: "sdr", name: "SDR Lead", role: "SDR Team Lead", tier: "specialist",
    prompt: "You are the SDR Team Lead. Build the outbound engine. Cover: cold outreach sequences, lead qualification criteria, follow-up cadence, and personalization framework. Keep it under 400 words." },
  { key: "partnerships", name: "Partnerships", role: "Head of Partnerships", tier: "specialist",
    prompt: "You are the Head of Partnerships. Identify partnership opportunities. Cover: partnership targets, pitch approach, affiliate program design, and integration strategy. Keep it under 400 words." },
  { key: "investor_relations", name: "Investor Relations", role: "Head of IR", tier: "specialist",
    prompt: "You are the Head of Investor Relations. Prepare the fundraising strategy. Cover: investor update template, pitch deck outline, cap table considerations, and fundraising timeline. Keep it under 400 words." },
  { key: "head_of_recruiting", name: "Head of Recruiting", role: "Head of Recruiting", tier: "specialist",
    prompt: "You are the Head of Recruiting. Build the talent acquisition plan. Cover: job descriptions for first roles, hiring process design, culture-fit interview questions, and employer brand strategy. Keep it under 400 words." },
  { key: "customer_success", name: "Customer Success", role: "Head of Customer Success", tier: "specialist",
    prompt: "You are the Head of Customer Success. Design the CS program. Cover: onboarding playbook, health scoring model, expansion/upsell triggers, and churn prevention strategies. Keep it under 400 words." },
];

const ALL_AGENTS = [...WAVE_1, ...WAVE_2];

// ─── Helper: build project context ──────────────────────────
async function buildContext(sb: ReturnType<typeof getSupabase>, projectId: string): Promise<string> {
  try {
    const [projectRes, tasksRes, notesRes] = await Promise.all([
      sb!.from("projects").select("*").eq("id", projectId).single(),
      sb!.from("project_tasks").select("title, done").eq("project_id", projectId),
      sb!.from("project_notes").select("content, source").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    ]);

    if (!projectRes.data) return "No project data found.";
    const p = projectRes.data;
    const tasks = tasksRes.data || [];
    const notes = notesRes.data || [];

    return `PROJECT: ${p.title}
Category: ${p.category || "N/A"}
Status: ${p.status}
Grade: ${p.grade}
Revenue Goal: ${p.revenue_goal || "Not set"}
Progress: ${p.progress}%

DESCRIPTION:
${p.description || "No description"}

TASKS:
${tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "None"}

RECENT NOTES & CHAT HISTORY:
${notes.map((n: { content: string; source: string }) => n.content).join("\n---\n") || "None"}`;
  } catch {
    return "Error loading project context.";
  }
}

// ─── Helper: call one agent ─────────────────────────────────
async function callAgent(
  client: Anthropic,
  agent: AgentDef,
  context: string,
  briefing?: string,
): Promise<{ key: string; name: string; role: string; tier: string; result: string }> {
  const systemParts = [agent.prompt];
  if (briefing) {
    systemParts.push(`\n\nBEFORE YOU BEGIN — here is the briefing from Wave 1 (CFO, CTO, CLO, COO). Use this to ground your recommendations in financial reality, technical constraints, legal requirements, and operational capacity:\n\n${briefing}`);
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemParts.join(""),
    messages: [{ role: "user", content: `Analyze this project:\n\n${context}` }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";
  return { key: agent.key, name: agent.name, role: agent.role, tier: agent.tier, result };
}

// ─── POST handler ───────────────────────────────────────────
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });
  const context = await buildContext(sb, projectId);

  try {
    // ── Wave 1: Foundation (4 concurrent calls) ──────────
    const wave1Results = await Promise.all(
      WAVE_1.map((agent) => callAgent(client, agent, context))
    );

    const briefing = wave1Results.map((r) => `## ${r.name} (${r.role})\n${r.result}`).join("\n\n---\n\n");

    // ── Wave 2: Full org (17 concurrent calls with briefing) ──
    const wave2Results = await Promise.all(
      WAVE_2.map((agent) => callAgent(client, agent, context, briefing))
    );

    const allResults = [...wave1Results, ...wave2Results];

    // ── Save all results to project_notes ────────────────
    const inserts = allResults.map((r) => ({
      project_id: projectId,
      content: `[War Room — ${r.name}]\n\n${r.result}`,
      source: `war_room_${r.key}`,
    }));

    await sb.from("project_notes").insert(inserts);

    // ── Build Jarvis Summary ────────────────────────────
    const summaryResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are JARVIS, the AI chief of staff. You just ran a full War Room deployment with 21 agents analyzing a project. Synthesize their outputs into an executive summary with exactly 3 sections:

1. **What the team agreed on** — 3-5 bullet points of consensus across agents
2. **Key conflicts flagged** — 2-4 areas where agents disagreed or flagged tensions
3. **Recommended next steps** — 5 prioritized action items with the responsible agent

Be concise and actionable. No fluff. Under 400 words.`,
      messages: [{ role: "user", content: `Here are the 21 agent analyses:\n\n${allResults.map((r) => `## ${r.name}\n${r.result}`).join("\n\n---\n\n")}` }],
    });

    const summaryBlock = summaryResponse.content.find((b) => b.type === "text");
    const summary = summaryBlock && summaryBlock.type === "text" ? summaryBlock.text : "Summary generation failed.";

    // Save summary
    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[War Room — JARVIS Summary]\n\n${summary}`,
      source: "war_room_summary",
    });

    return Response.json({
      ok: true,
      summary,
      agents: allResults.map((r) => ({
        key: r.key,
        name: r.name,
        role: r.role,
        tier: r.tier,
        result: r.result,
      })),
      wave1Keys: WAVE_1.map((a) => a.key),
      wave2Keys: WAVE_2.map((a) => a.key),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─── GET: return agent roster for UI ────────────────────────
export async function GET() {
  return Response.json({
    agents: ALL_AGENTS.map((a) => ({ key: a.key, name: a.name, role: a.role, tier: a.tier })),
    wave1Keys: WAVE_1.map((a) => a.key),
    wave2Keys: WAVE_2.map((a) => a.key),
  });
}
