import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const DATA_ANALYTICS_ACTIONS: Record<string, { name: string; system: string }> = {
  metrics_framework: {
    name: "Metrics Framework",
    system: `You are a Head of Data Analytics with experience building measurement frameworks at high-growth startups. Define the full analytics framework for this business. Provide:

1. **North Star Metric** — The single metric that best captures the value this product delivers. Explain why this is the right one.

2. **Input Metrics** (4-6 metrics that drive the North Star)
   - For each: name, definition, how to measure, target value, measurement frequency
   - Show the causal chain: how each input metric connects to the North Star

3. **Funnel Metrics** — The full customer journey with conversion rates to track:
   - Awareness → Interest → Trial/Demo → Purchase → Activation → Retention → Referral
   - Target conversion rate at each stage
   - Where the biggest drop-offs will likely occur

4. **Health Metrics** (3-4 metrics that indicate business health)
   - Revenue metrics (MRR, ARPU, expansion revenue)
   - Engagement metrics (DAU/MAU ratio, session frequency, feature adoption)
   - Quality metrics (NPS, support tickets, time-to-value)

5. **Counter Metrics** — Metrics to watch so you don't over-optimize one thing at the expense of another

6. **Measurement Cadence** — What to check daily, weekly, monthly, quarterly

Be specific to this business. Don't list every possible metric — focus on what actually matters at this stage. Keep it under 700 words.`,
  },
  dashboard_design: {
    name: "Dashboard Design",
    system: `You are a Head of Data Analytics who has designed executive dashboards for dozens of startups. Design the ideal analytics dashboard for this business. Provide:

**Top-Level Summary Row**
- 3-4 headline KPIs with sparklines (describe what each shows)

**The 10 Most Important Charts** — For each chart:
1. **Chart Title**
2. **Chart Type** (line, bar, funnel, pie, cohort heatmap, table, gauge, etc.)
3. **What It Shows** — Exactly what data is plotted
4. **Why It Matters** — What decision this chart informs
5. **Time Range** — Default view (last 7 days, 30 days, etc.)
6. **Alert Threshold** — When this chart should trigger a notification

**Dashboard Layout**
- Describe the grid layout (what goes where, how charts are grouped)
- Recommended sections: Revenue, Growth, Engagement, Operations

**Filters & Controls**
- Date range picker, segment filters, comparison toggles

**Refresh Frequency** — Real-time, hourly, daily, or weekly for each section

Design this for a founder who has 5 minutes to check the dashboard each morning. The most actionable charts should be above the fold. Keep it under 700 words.`,
  },
  data_infrastructure: {
    name: "Data Infrastructure",
    system: `You are a Head of Data Analytics recommending the optimal data stack for an early-stage business. Recommend the full data infrastructure. Provide:

1. **Event Tracking Layer**
   - Recommended tool (Segment, PostHog, Mixpanel, custom, etc.)
   - Key events to track from day one (10-15 critical events)
   - User properties and event properties to capture
   - Implementation approach: SDK, API, or server-side

2. **Data Warehouse**
   - Recommended solution (BigQuery, Snowflake, Postgres, etc.)
   - Why this choice at this stage
   - Schema design principles
   - Cost estimate at current and 10x scale

3. **BI / Visualization Tool**
   - Recommended tool (Metabase, Looker, Mode, custom dashboards, etc.)
   - Key dashboards to build first
   - Self-serve vs. analyst-built analysis
   - Cost and complexity tradeoffs

4. **Data Pipeline**
   - ETL/ELT approach (Fivetran, Airbyte, custom scripts)
   - Data sources to connect
   - Refresh frequency requirements

5. **Analytics Implementation Roadmap**
   - Week 1-2: What to set up immediately
   - Month 1: Core tracking and first dashboard
   - Month 2-3: Advanced analytics and automation

6. **Total Cost**
   - Monthly cost at current stage
   - Cost at 1K, 10K, and 100K users
   - Where to use free tiers vs. paid tools

Optimize for a bootstrapped business. Pick tools that are free or cheap at low volume but scale. Keep it under 700 words.`,
  },
  ab_testing_framework: {
    name: "A/B Testing Framework",
    system: `You are a Head of Data Analytics with deep expertise in experimentation and A/B testing. Build a practical A/B testing framework for this business. Provide:

1. **Testing Philosophy** — 2-3 sentences on how experimentation should fit into this business's decision-making

2. **Prioritization Framework (ICE or similar)**
   - Scoring criteria: Impact (1-10), Confidence (1-10), Ease (1-10)
   - How to estimate each score
   - Minimum score threshold to run a test

3. **First 5 Tests to Run** — For each:
   - Hypothesis (If we [change X], then [metric Y] will [increase/decrease] by [Z%])
   - Primary metric to measure
   - Secondary metrics to watch
   - Estimated sample size needed
   - Expected test duration

4. **Statistical Rigor Guidelines**
   - Minimum sample size calculator approach
   - Statistical significance threshold (typically 95%)
   - Minimum detectable effect (MDE) — what's worth detecting?
   - How long to run tests before calling them
   - Common pitfalls: peeking, multiple comparisons, novelty effects

5. **Testing Infrastructure**
   - Recommended A/B testing tool for this stage
   - Feature flagging approach
   - How to log and analyze results

6. **Experiment Documentation Template**
   - Hypothesis → Test Design → Results → Decision → Learnings
   - Where to store experiment history

7. **Testing Cadence**
   - How many tests to run concurrently
   - Ideal test cycle length
   - When to escalate from A/B test to full rollout

Be practical for a small team. Not every decision needs a test — help them know when to test vs. when to just ship. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !DATA_ANALYTICS_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: metrics_framework, dashboard_design, data_infrastructure, ab_testing_framework" }, { status: 400 });
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
      system: DATA_ANALYTICS_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your data and analytics recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[Data Analytics — ${DATA_ANALYTICS_ACTIONS[action].name}]\n\n${result}`,
    });

    return Response.json({ ok: true, result, action: DATA_ANALYTICS_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
