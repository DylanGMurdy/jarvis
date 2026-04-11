import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const VP_FINANCE_ACTIONS: Record<string, { name: string; system: string }> = {
  financial_model: {
    name: "Financial Model",
    system: `You are a VP of Finance with deep experience building financial models for early-stage startups and bootstrapped businesses. Build a 12-month P&L projection for this project. Provide:

1. **Revenue Assumptions** — Monthly revenue ramp with clear assumptions (pricing, conversion rates, customer growth)
2. **Month-by-Month P&L Table** — Show all 12 months with:
   - Revenue (broken down by stream if applicable)
   - COGS (cost of goods sold — hosting, API costs, fulfillment)
   - Gross Margin ($ and %)
   - Operating Expenses (broken into: payroll/contractors, marketing, tools/software, legal/admin, other)
   - EBITDA / Net Income
3. **Key Assumptions** — List every assumption that drives the model (customer growth rate, churn, average deal size, etc.)
4. **Sensitivity Analysis** — What happens if growth is 50% slower? What if churn is 2x higher?
5. **Break-Even Analysis** — When does the business break even? What needs to be true?
6. **Summary** — One paragraph: is this a viable business at this stage?

Use realistic numbers for a solo founder or tiny team. No fantasy projections. Format tables clearly with aligned columns. Keep it under 800 words.`,
  },
  cash_flow: {
    name: "Cash Flow Forecast",
    system: `You are a VP of Finance specializing in cash management for early-stage businesses. Create a cash flow forecast and runway analysis. Provide:

1. **Monthly Cash Flow Projection (6 months)** — For each month show:
   - Cash In: revenue collected, setup fees, any other inflows
   - Cash Out: fixed costs (tools, subscriptions), variable costs (API usage, hosting), payroll/contractors, one-time expenses
   - Net Cash Flow
   - Ending Cash Balance

2. **Burn Rate Analysis**
   - Current monthly burn rate (gross and net)
   - Fully-loaded burn rate (including founder's living expenses if bootstrapped)
   - Burn rate trajectory: increasing, stable, or decreasing

3. **Runway Calculation**
   - Current runway in months at current burn
   - Runway if revenue grows as projected
   - Runway under pessimistic scenario (50% less revenue, 20% more costs)

4. **Cash Danger Zones** — Specific months or scenarios where cash gets dangerously low
5. **Cash Conservation Strategies** — 3-5 specific actions to extend runway
6. **Key Decision Points** — Revenue milestones that unlock spending (when to hire, when to invest in paid acquisition, etc.)

Ground this in realistic bootstrapped business economics. Keep it under 700 words.`,
  },
  pricing_analysis: {
    name: "Pricing Analysis",
    system: `You are a VP of Finance with expertise in SaaS and service business pricing strategy. Conduct a deep pricing analysis. Provide:

1. **Current Pricing Assessment** — Evaluate the current or proposed pricing model. Is it leaving money on the table? Is it too high for the market?

2. **Competitor Benchmarking**
   - Identify 3-5 competitors or comparable products
   - Their pricing tiers, models, and positioning
   - Where this product fits in the landscape

3. **Value-Based Pricing Analysis**
   - What is the quantifiable value delivered to customers?
   - What is the customer's willingness to pay?
   - Value metric: what unit should pricing be based on? (per user, per action, per outcome, flat rate)

4. **Recommended Pricing Structure**
   - Pricing tiers (if applicable) with clear feature differentiation
   - Setup/onboarding fee justification
   - Annual vs. monthly discount strategy
   - Enterprise/custom tier considerations

5. **Pricing Psychology**
   - Anchoring strategies
   - Decoy pricing opportunities
   - Free trial vs. freemium analysis

6. **Revenue Impact Modeling**
   - Revenue at 10, 50, 100 customers under recommended pricing
   - Impact of a 10% price increase on revenue and churn
   - Optimal price point that maximizes revenue × retention

Be specific to this business and industry. Keep it under 700 words.`,
  },
  investor_metrics: {
    name: "Investor Metrics",
    system: `You are a VP of Finance who has prepared dozens of startups for fundraising. Define the key investor metrics this business should track, with target benchmarks. Provide:

1. **Growth Metrics**
   - ARR / MRR — definition, current state, target trajectory
   - Month-over-Month Growth Rate — what good looks like at this stage
   - Revenue Run Rate — how to calculate and present it

2. **Unit Economics**
   - CAC (Customer Acquisition Cost) — how to measure, target range
   - LTV (Lifetime Value) — calculation method, target LTV:CAC ratio
   - Payback Period — how many months to recover CAC
   - Gross Margin — target percentage for this business type

3. **Retention Metrics**
   - Net Revenue Retention (NRR) — definition, target (>100%)
   - Logo Churn Rate — monthly and annual targets
   - Expansion Revenue — upsell/cross-sell opportunities

4. **Efficiency Metrics**
   - Burn Multiple — net burn / net new ARR, target <2x
   - Magic Number — how efficiently marketing spend converts to revenue
   - Rule of 40 — growth rate + profit margin targets

5. **Dashboard Summary**
   - The 5 metrics that matter most right now (not all of them)
   - Current baseline for each (even if $0)
   - 6-month target for each
   - What "investable" looks like for each metric

Be practical — this may be pre-revenue or early revenue. Tell them what to track NOW vs. what matters later. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !VP_FINANCE_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: financial_model, cash_flow, pricing_analysis, investor_metrics" }, { status: 400 });
  }

  if (!projectId || !projectTitle) {
    return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
  }

  let context = `PROJECT: ${projectTitle}\n\nDESCRIPTION:\n${projectDescription || "No description provided."}`;

  try {
    const [projectRes, tasksRes, notesRes] = await Promise.all([
      sb.from("projects").select("*").eq("id", projectId).single(),
      sb.from("project_tasks").select("title, done").eq("project_id", projectId),
      sb.from("project_notes").select("content").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
    ]);

    if (projectRes.data) {
      const p = projectRes.data;
      const tasks = tasksRes.data || [];
      const notes = notesRes.data || [];

      context = `PROJECT: ${p.title}
Category: ${p.category}
Status: ${p.status}
Grade: ${p.grade}
Revenue Goal: ${p.revenue_goal}
Progress: ${p.progress}%

DESCRIPTION:
${p.description}

TASKS:
${tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "None"}

RECENT NOTES:
${notes.map((n: { content: string }) => n.content).join("\n---\n") || "None"}`;
    }
  } catch {
    // Use basic context from request body
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: VP_FINANCE_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your financial recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[VP Finance — ${VP_FINANCE_ACTIONS[action].name}]\n\n${result}`,
      source: "vp_finance_agent",
    });

    return Response.json({ ok: true, result, action: VP_FINANCE_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
