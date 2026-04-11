import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "operations_plan" | "hiring_plan" | "process_map" | "kpis";

const SYSTEM_PROMPT = `You are the COO (Chief Operating Officer) agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He's a solo founder who values lean operations, automation over hiring, and protecting family time (evenings 6-8pm are sacred).

Your role: Design operational systems that let one person run multiple businesses efficiently. Favor automation and AI agents over human hires. Be specific about tools, time blocks, and workflows. Dylan's time is the scarcest resource — optimize ruthlessly for it.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  operations_plan: (title, desc) => `Build a day-to-day operations plan for "${title}".

Project description: ${desc}

Provide:
1. **Daily Operations Schedule** — hour-by-hour time blocks for running this business (assume Dylan has 2-3 hours/day max for this project)
2. **Weekly Cadence** — what happens each day of the week (Monday = planning, Friday = review, etc.)
3. **Monthly Rituals** — billing, reporting, client check-ins, content batching
4. **Automation Opportunities** — what can be automated with Lindy/Zapier/AI agents vs what requires Dylan personally
5. **Delegation Framework** — what gets delegated to AI, what gets delegated to contractors, what Dylan must do himself
6. **Time Budget** — realistic weekly hours breakdown by activity`,

  hiring_plan: (title, desc) => `Create a hiring and automation plan for "${title}".

Project description: ${desc}

Provide:
1. **Roles Needed** — every function this business requires to operate (sales, support, fulfillment, etc.)
2. **Automate First** — for each role, can it be handled by AI/automation? If yes, which tool and how
3. **Hire When** — at what revenue/customer threshold does each role need a human
4. **First Hire** — the single most impactful hire and when to make it (revenue trigger, not timeline)
5. **Contractor vs Employee** — for each human role, which is better and why
6. **Cost Projections** — monthly cost at 10, 50, 100 customers for team/tools
7. **Org Chart Evolution** — what the team looks like at $5K, $25K, $100K MRR`,

  process_map: (title, desc) => `Map out the core business processes for "${title}".

Project description: ${desc}

Provide:
1. **Customer Journey** — every step from first touch to paying customer to renewal
2. **Fulfillment Process** — step-by-step how the product/service gets delivered
3. **Sales Process** — lead → qualify → demo → close → onboard
4. **Support Process** — how customer issues get handled (tiers, escalation, SLAs)
5. **Billing Process** — invoicing, payment collection, failed payments, churn recovery
6. **Quality Assurance** — how to ensure consistent delivery
7. **Bottlenecks** — where will things break first at scale, and how to prevent it

For each process, specify: trigger → steps → owner (Dylan/AI/contractor) → output → tools used.`,

  kpis: (title, desc) => `Define the 5 most important KPIs to track for "${title}".

Project description: ${desc}

For each KPI provide:
1. **Metric Name** — clear, specific name
2. **Why It Matters** — what business question it answers
3. **How to Calculate** — exact formula
4. **Target** — what good looks like at month 1, 3, 6, 12
5. **Data Source** — where the number comes from (Stripe, Supabase, manual tracking, etc.)
6. **Review Cadence** — daily, weekly, or monthly
7. **Red Flag Threshold** — when to take action

Also provide:
- **Dashboard Layout** — how these 5 KPIs should be displayed for a quick daily check
- **Leading vs Lagging** — which KPIs predict future performance vs reflect past results`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: operations_plan, hiring_plan, process_map, or kpis" }, { status: 400 });
    }

    if (!projectId || !projectTitle) {
      return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const claude = new Anthropic({ apiKey });
    const prompt = ACTION_PROMPTS[action as Action](projectTitle, projectDescription || "No description provided");

    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const output = msg.content[0].type === "text" ? msg.content[0].text : "";

    const sb = getSupabaseAdmin();
    if (sb) {
      const labels: Record<Action, string> = {
        operations_plan: "Operations Plan",
        hiring_plan: "Hiring Plan",
        process_map: "Process Map",
        kpis: "KPIs",
      };
      await sb.from("project_notes").insert({
        id: `coo-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[COO Agent — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
