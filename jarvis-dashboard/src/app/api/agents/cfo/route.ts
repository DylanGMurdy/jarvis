import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "revenue_model" | "unit_economics" | "funding_needs" | "financial_risks";

const SYSTEM_PROMPT = `You are the CFO (Chief Financial Officer) agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He thinks in terms of recurring revenue, lean operations, and bootstrap-first approaches.

Your role: Provide sharp, realistic financial analysis. No fluff. Use real numbers and assumptions. Format with clear sections, tables where helpful, and actionable takeaways. Always state your assumptions explicitly so Dylan can adjust them.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  revenue_model: (title, desc) => `Build a detailed revenue model for "${title}".

Project description: ${desc}

Provide:
1. **Pricing Strategy** — recommended pricing tiers, justification
2. **Revenue Streams** — all ways this project makes money (primary, secondary, upsells)
3. **12-Month Revenue Projection** — month-by-month table with assumptions (customer growth rate, churn, ARPU)
4. **Key Assumptions** — list every assumption so Dylan can sanity-check them
5. **Revenue Milestones** — when does this hit $1K/mo, $5K/mo, $10K/mo MRR?`,

  unit_economics: (title, desc) => `Calculate unit economics for "${title}".

Project description: ${desc}

Provide:
1. **Customer Acquisition Cost (CAC)** — estimated marketing/sales cost per customer, broken down by channel
2. **Lifetime Value (LTV)** — based on ARPU, gross margin, and expected retention
3. **LTV:CAC Ratio** — with assessment (healthy = 3:1+)
4. **Payback Period** — months to recoup CAC
5. **Gross Margin** — revenue minus direct costs (hosting, API costs, support time)
6. **Contribution Margin** — after allocating Dylan's time
7. **Break-Even Analysis** — how many customers to cover fixed costs

Be specific with dollar amounts. Use realistic estimates for a solo founder / small team.`,

  funding_needs: (title, desc) => `Assess funding needs for "${title}".

Project description: ${desc}

Provide:
1. **Bootstrap Path** — what it costs to launch with just Dylan's time + existing tools. Timeline, tradeoffs, max revenue potential.
2. **Funded Path** — what $25K, $50K, $100K would unlock. What changes at each level.
3. **Resource Requirements** — tools, subscriptions, contractors, time investment per week
4. **Cash Flow Timeline** — when does revenue exceed expenses on the bootstrap path?
5. **Recommendation** — bootstrap or seek funding? Why?

Dylan prefers bootstrapping. Only recommend funding if there's a compelling reason.`,

  financial_risks: (title, desc) => `Identify the top 5 financial risks for "${title}".

Project description: ${desc}

For each risk provide:
1. **Risk** — what could go wrong financially
2. **Probability** — Low / Medium / High
3. **Impact** — dollar amount or percentage revenue at risk
4. **Mitigation** — specific action to reduce or eliminate the risk
5. **Early Warning Sign** — what to watch for

Also provide:
- **Worst Case Scenario** — if multiple risks hit simultaneously
- **Insurance Strategies** — how to protect downside (diversification, contracts, reserves)`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: revenue_model, unit_economics, funding_needs, or financial_risks" }, { status: 400 });
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

    // Save to project notes
    const sb = getSupabaseAdmin();
    if (sb) {
      const labels: Record<Action, string> = {
        revenue_model: "Revenue Model",
        unit_economics: "Unit Economics",
        funding_needs: "Funding Needs",
        financial_risks: "Financial Risks",
      };
      await sb.from("project_notes").insert({
        id: `cfo-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[CFO Agent — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
