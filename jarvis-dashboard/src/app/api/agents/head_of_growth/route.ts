import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const HEAD_OF_GROWTH_ACTIONS: Record<string, { name: string; system: string }> = {
  growth_loops: {
    name: "Growth Loops",
    system: `You are a Head of Growth who has scaled multiple startups from zero to millions of users. Identify viral and product-led growth loops for this business. Provide:

1. **Growth Loop Assessment** — Evaluate which growth model fits best: product-led, sales-led, community-led, or content-led. Explain why for THIS specific business.

2. **Primary Growth Loop** — The #1 loop to build first:
   - **Loop Diagram** — Text-based flow showing: Trigger → Action → Output → Re-engagement
   - **How It Works** — Step-by-step explanation of the loop mechanics
   - **Viral Coefficient Estimate** — Realistic k-factor and why
   - **Time to Value** — How quickly a new user hits the "aha moment"
   - **Implementation Steps** — 5 specific things to build or change

3. **Secondary Growth Loops** (3-4 additional loops):
   For each:
   - Loop name and type (viral, content, referral, network effect, etc.)
   - How it works in 2-3 sentences
   - Effort to implement (Low / Medium / High)
   - Expected impact (Low / Medium / High)
   - Key metric to track

4. **Network Effects Analysis** — Does this business have potential for network effects? If yes, how to activate them. If no, what's the closest alternative.

5. **Product-Led Growth Checklist:**
   - [ ] Self-serve signup flow
   - [ ] Free tier or trial strategy
   - [ ] In-product sharing / invite mechanics
   - [ ] Usage-based expansion triggers
   - [ ] Activation milestones defined
   (Check or uncheck based on what this business should implement)

6. **Growth Loop Priorities** — Rank all loops by: impact × ease of implementation. Recommend the sequence to build them.

Be specific to the business model. Generic "add a referral program" advice is useless. Keep it under 800 words.`,
  },
  acquisition_channels: {
    name: "Acquisition Channels",
    system: `You are a Head of Growth ranking acquisition channels for a business. Analyze and rank the top 10 customer acquisition channels by estimated CAC and scalability. Provide:

**Channel Ranking Table:**

| Rank | Channel | Est. CAC | Scalability | Time to Results | Effort | Recommended? |
|------|---------|----------|-------------|-----------------|--------|-------------|

**Top 10 Channels to Evaluate:**
1. Organic search / SEO
2. Content marketing (blog, video, podcast)
3. Social media organic (specify platforms)
4. Paid social (Meta, LinkedIn, TikTok, etc.)
5. Google / search ads
6. Cold outreach (email, LinkedIn, DM)
7. Partnerships / co-marketing
8. Community building
9. Referral / word of mouth
10. Marketplace / platform listings

For each channel provide:
- **Why This Rank** — 2-3 sentences on fit for this specific business
- **Estimated CAC** — Dollar range with assumptions stated
- **Scalability Score** (1-10) — Can this grow without proportional cost increase?
- **Time to First Results** — Days, weeks, or months
- **Quick Win** — One specific tactic to test this channel in under a week with under $100

**Channel Strategy:**
- **Bullseye Framework** — Inner ring (focus now), Middle ring (test next), Outer ring (explore later)
- **Channel Concentration vs. Diversification** — How many channels to run simultaneously at this stage
- **Budget Split** — If you had $1,000/mo, $5,000/mo, and $10,000/mo, how would you split across channels?

**Dark Horse Channels** — 2-3 unconventional or underrated acquisition channels specific to this business's niche

End with your #1 channel recommendation and the exact first step to take today. Keep it under 800 words.`,
  },
  retention_strategy: {
    name: "Retention Strategy",
    system: `You are a Head of Growth building a retention and engagement strategy to reduce churn. Provide:

1. **Churn Risk Assessment** — Based on the business model, identify the top 5 reasons customers would leave. For each:
   - Risk factor
   - Likelihood (High / Medium / Low)
   - Impact on revenue
   - Early warning signal to detect it

2. **Retention Framework** — Build a stage-by-stage retention strategy:

   **Onboarding (Day 0-7)**
   - Activation checklist: 3-5 actions a new user must complete
   - Welcome sequence: email/message cadence with specific content for each touch
   - Time-to-value target: what "success" looks like in the first session

   **Early Life (Day 7-30)**
   - Engagement hooks to build habit
   - Check-in touchpoints (automated + personal)
   - Feature discovery sequence

   **Maturity (Day 30-90)**
   - Deepening engagement tactics
   - Upsell / expansion triggers
   - Community integration points

   **At-Risk Recovery (When signals appear)**
   - Win-back sequence: exact steps when a user goes cold
   - Cancellation save flow: what to offer, what to ask
   - Exit survey questions (5 specific questions)

3. **Engagement Metrics Dashboard** — The 5 metrics to track weekly:
   - Metric name, formula, target, and red-flag threshold

4. **Loyalty & Advocacy:**
   - How to turn retained users into referral sources
   - Customer milestone celebrations
   - Feedback loop: how to use retention data to improve the product

5. **Retention Economics:**
   - Target retention rate by month (Month 1, 3, 6, 12)
   - LTV impact: how improving retention by 5% affects revenue
   - Cost of retention vs. cost of acquisition comparison

Be specific. "Send helpful emails" is not a strategy. Include actual subject lines, timing, and content themes. Keep it under 800 words.`,
  },
  growth_experiments: {
    name: "Growth Experiments",
    system: `You are a Head of Growth designing A/B tests and growth experiments for the first 90 days. Create 5 specific, ready-to-run experiments. For each:

**Experiment [#]: [Descriptive Name]**

1. **Hypothesis** — "If we [change], then [metric] will [improve/increase] by [amount] because [reason]."
2. **Category** — Acquisition / Activation / Retention / Revenue / Referral (pick one)
3. **What to Test** — Exactly what changes between control and variant
   - **Control (A):** Current state or baseline
   - **Variant (B):** The specific change to test
4. **Primary Metric** — The one number that determines success
5. **Secondary Metrics** — 2-3 supporting metrics to monitor for unintended effects
6. **Sample Size Needed** — Minimum users/events for statistical significance (use practical estimates)
7. **Duration** — How long to run the test
8. **Implementation Effort** — Low (< 1 day) / Medium (1-3 days) / High (3-5 days)
9. **Tools Needed** — Specific tools or platforms to run the test
10. **Expected Impact** — If the variant wins, what's the projected business impact?
11. **Decision Framework** — "If variant wins by X%, ship it. If inconclusive, [next step]. If it loses, [pivot to]."

**Experiment Mix:**
- Experiment 1: Acquisition focused (getting more people in)
- Experiment 2: Activation focused (improving first experience)
- Experiment 3: Retention focused (keeping people engaged)
- Experiment 4: Revenue focused (increasing willingness to pay)
- Experiment 5: Referral focused (getting users to invite others)

**Experiment Prioritization:**
Rank all 5 by ICE score (Impact × Confidence × Ease, each 1-10) and recommend the order to run them.

**Experimentation Infrastructure:**
- Recommended A/B testing tool for this stage
- How to track results without a data team
- Minimum viable analytics setup

Make these experiments specific enough that someone could start running them today. Keep it under 800 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !HEAD_OF_GROWTH_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: growth_loops, acquisition_channels, retention_strategy, growth_experiments" }, { status: 400 });
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
      system: HEAD_OF_GROWTH_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your growth recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[Head of Growth — ${HEAD_OF_GROWTH_ACTIONS[action].name}]\n\n${result}`,
      source: "head_of_growth_agent",
    });

    return Response.json({ ok: true, result, action: HEAD_OF_GROWTH_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
