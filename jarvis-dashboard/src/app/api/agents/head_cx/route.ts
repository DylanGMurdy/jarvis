import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "cx_strategy" | "nps_program" | "support_stack" | "voice_of_customer";

const SYSTEM_PROMPT = `You are the Head of Customer Experience agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He's known for friendly, genuine relationships — his customers feel like they're working with a friend, not a vendor. He values personal touch at scale.

Your role: Design customer experiences that feel personal even when automated. Think in terms of customer emotions at each touchpoint. Dylan's businesses are small enough that every customer matters — one bad experience is a real problem, one great experience generates referrals. Optimize for delight and retention over efficiency.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  cx_strategy: (title, desc) => `Build a complete customer experience strategy for "${title}".

Project description: ${desc}

Provide:
1. **Customer Journey Map** — every stage from awareness to loyal advocate, with emotions at each stage
2. **Touchpoint Inventory** — every interaction point (email, onboarding, support, check-in, renewal) with owner and channel
3. **Moment of Truth** — the 3 moments that make or break the customer relationship
4. **Delight Opportunities** — 5 specific ways to exceed expectations (low-cost, high-impact surprises)
5. **Friction Points** — likely frustrations and how to eliminate them proactively
6. **Retention Strategy** — what keeps customers from churning at month 1, 3, 6, 12
7. **Referral Engine** — how to turn happy customers into active referrers
8. **CX Metrics** — the 5 numbers to track (CSAT, NPS, churn, response time, referral rate)`,

  nps_program: (title, desc) => `Design an NPS program for "${title}".

Project description: ${desc}

Provide:
1. **Survey Design** — the exact NPS question + 2-3 follow-up questions, when to ask (trigger events)
2. **Survey Cadence** — frequency, timing within the customer lifecycle, channel (email, in-app, SMS)
3. **Scoring Framework** — how to interpret scores at the business level (what's good for this stage)
4. **Promoter Playbook** — what to do when someone scores 9-10 (referral ask, testimonial, case study)
5. **Passive Playbook** — what to do for 7-8 scores (identify friction, personalized outreach)
6. **Detractor Playbook** — what to do for 0-6 scores (immediate response, escalation, recovery)
7. **Closing the Loop** — how to communicate back to customers what changed because of their feedback
8. **Reporting Cadence** — weekly/monthly NPS review template with trending and action items`,

  support_stack: (title, desc) => `Recommend the ideal customer support tech stack for "${title}".

Project description: ${desc}

For each stage of growth provide the recommended stack:

**Stage 1: 0-25 customers (Solo founder)**
- Tools, cost, and why

**Stage 2: 25-100 customers (Need some automation)**
- Tools, cost, and why

**Stage 3: 100+ customers (Need dedicated support)**
- Tools, cost, and why

For each tool recommendation include:
1. **Tool Name** — specific product
2. **What It Does** — one-line purpose
3. **Monthly Cost** — at the relevant customer count
4. **Alternatives** — 1-2 alternatives and why the recommended tool wins
5. **Integration** — how it connects to the existing stack (Supabase, Next.js, Lindy)

Also provide:
- **DIY Option** — what can Dylan build himself vs what's better to buy
- **Support SLA** — recommended response time targets for each stage
- **Self-Service Strategy** — what to build so customers can help themselves`,

  voice_of_customer: (title, desc) => `Design a Voice of Customer (VoC) program for "${title}".

Project description: ${desc}

Provide:
1. **Feedback Channels** — every way to capture customer feedback (surveys, support tickets, social, calls, usage data)
2. **Collection Cadence** — when and how often to collect each type of feedback
3. **Categorization Framework** — how to tag and organize feedback (feature requests, bugs, praise, complaints)
4. **Prioritization System** — how to decide which feedback to act on (frequency × impact × effort)
5. **Insight Synthesis** — monthly process to turn raw feedback into actionable insights
6. **Customer Advisory Board** — how to set up a small group of power users for deeper feedback
7. **Feedback-to-Feature Pipeline** — how customer feedback flows into the product roadmap
8. **Communication Loop** — how to tell customers their feedback was heard and acted on
9. **Win/Loss Analysis** — how to learn from customers who churned and prospects who didn't convert`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: cx_strategy, nps_program, support_stack, or voice_of_customer" }, { status: 400 });
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
        cx_strategy: "CX Strategy",
        nps_program: "NPS Program",
        support_stack: "Support Stack",
        voice_of_customer: "Voice of Customer",
      };
      await sb.from("project_notes").insert({
        id: `head-cx-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[Head of CX — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
