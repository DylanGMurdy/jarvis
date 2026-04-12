import Anthropic from "@anthropic-ai/sdk";

// ─── Per-agent system prompt builder ────────────────────────
// Each prompt is short (~200 tokens) so the call returns in ~3s
const AGENT_PROMPTS: Record<string, { role: string; prompt: string }> = {
  CFO: { role: "Chief Financial Officer", prompt: "You are the CFO. Output 4 short sections: Revenue Model, Unit Economics (CAC/LTV/margins), Funding Need, Top 3 Financial Risks. Bullets only. Under 250 words." },
  CTO: { role: "Chief Technology Officer", prompt: "You are the CTO. Output 4 short sections: Tech Stack, MVP Scope (3-5 features), Build Timeline, Top 3 Technical Risks. Bullets only. Under 250 words." },
  CLO: { role: "Chief Legal Officer", prompt: "You are the CLO. Output 4 short sections: Entity Structure, Top Legal Risks, Contracts Needed, Compliance Requirements. Bullets only. Under 250 words." },
  COO: { role: "Chief Operations Officer", prompt: "You are the COO. Output 4 short sections: Operations Plan, Key Processes, Automate vs Hire, Top 5 KPIs. Bullets only. Under 250 words." },
  CMO: { role: "Chief Marketing Officer", prompt: "You are the CMO. Output: ICP, top 3 channels, content strategy, brand position. Bullets. Under 200 words." },
  CSO: { role: "Chief Sales Officer", prompt: "You are the CSO. Output: ICP, sales process, pricing, outreach approach. Bullets. Under 200 words." },
  "VP Sales": { role: "VP of Sales", prompt: "You are the VP Sales. Output: pipeline structure, objection handling, demo script outline, close playbook. Bullets. Under 200 words." },
  "VP Product": { role: "VP of Product", prompt: "You are the VP Product. Output: product vision, 3-phase roadmap, personas, differentiation. Bullets. Under 200 words." },
  "VP Engineering": { role: "VP of Engineering", prompt: "You are the VP Engineering. Output: architecture, 4-week sprint plan, tech debt strategy, API design. Bullets. Under 200 words." },
  "VP Marketing": { role: "VP of Marketing", prompt: "You are the VP Marketing. Output: brand strategy, launch plan, budget split, 90-day campaigns. Bullets. Under 200 words." },
  "VP Finance": { role: "VP of Finance", prompt: "You are the VP Finance. Output: 12-month revenue projection, cash flow, pricing, key investor metrics. Bullets. Under 200 words." },
  "VP Operations": { role: "VP of Operations", prompt: "You are the VP Operations. Output: ops stack, SOP framework, vendor strategy, scaling plan. Bullets. Under 200 words." },
  "Head of Growth": { role: "Head of Growth", prompt: "You are the Head of Growth. Output: growth loops, channel ranking, retention strategy, first 5 experiments. Bullets. Under 200 words." },
  "Head of Content": { role: "Head of Content", prompt: "You are the Head of Content. Output: content calendar, SEO strategy, content pillars, viral hooks. Bullets. Under 200 words." },
  "Head of Design": { role: "Head of Design", prompt: "You are the Head of Design. Output: design system principles, brand assets, UX patterns, UI components. Bullets. Under 200 words." },
  "Head of CX": { role: "Head of Customer Experience", prompt: "You are the Head of CX. Output: onboarding flow, support playbook, NPS program, voice-of-customer. Bullets. Under 200 words." },
  SDR: { role: "SDR Team Lead", prompt: "You are the SDR Lead. Output: outreach sequences, qualification criteria, follow-up cadence, personalization. Bullets. Under 200 words." },
  Partnerships: { role: "Head of Partnerships", prompt: "You are the Head of Partnerships. Output: partnership targets, pitch approach, affiliate program, integrations. Bullets. Under 200 words." },
  "Customer Success": { role: "Head of Customer Success", prompt: "You are the Head of CS. Output: onboarding playbook, health scoring, expansion triggers, churn prevention. Bullets. Under 200 words." },
  "Head of PR": { role: "Head of Public Relations", prompt: "You are the Head of PR. Output: press strategy, media targets, launch PR plan, thought leadership. Bullets. Under 200 words." },
  "Investor Relations": { role: "Head of IR", prompt: "You are the Head of IR. Output: investor update template, pitch deck outline, cap table notes, fundraising timeline. Bullets. Under 200 words." },
  "Head of Recruiting": { role: "Head of Recruiting", prompt: "You are the Head of Recruiting. Output: job descriptions for first roles, hiring process, culture-fit questions, employer brand. Bullets. Under 200 words." },
  "Master Orchestrator": { role: "Master Orchestrator", prompt: "You are the Master Orchestrator. Coordinate the team's outputs. Output: team alignment summary, execution priorities, dependency map, weekly cadence. Bullets. Under 200 words." },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: "API key not configured" }, { status: 500 });

  try {
    const { agentName, projectTitle, projectDescription, wave1Briefing } = await request.json();

    const def = AGENT_PROMPTS[agentName];
    if (!def) return Response.json({ ok: false, error: `Unknown agent: ${agentName}` }, { status: 400 });

    const description = (projectDescription || "No description").slice(0, 500);
    const context = `PROJECT: ${projectTitle}\nDESCRIPTION: ${description}`;

    const system = wave1Briefing
      ? `${def.prompt}\n\nWAVE 1 BRIEFING (financial, technical, legal, operational reality):\n${wave1Briefing}`
      : def.prompt;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: `Analyze:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    return Response.json({ ok: true, agentName, agentRole: def.role, result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
