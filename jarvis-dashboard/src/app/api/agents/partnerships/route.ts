import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const PARTNERSHIP_ACTIONS: Record<string, { name: string; system: string }> = {
  partnership_targets: {
    name: "Partnership Targets",
    system: `You are a VP of Partnerships who has built partner ecosystems that drove 40%+ of revenue. Identify the top 10 strategic partnership opportunities for this business. For each:

1. **Partner Type** — category of company (not a specific company name — describe the archetype)
2. **Why Partner** — how this partnership creates value for both sides
3. **Partnership Model** — referral, integration, co-sell, white-label, or channel
4. **Value to Them** — what they get from partnering with you
5. **Value to You** — what you get (distribution, credibility, revenue, data)
6. **Difficulty** (Easy / Medium / Hard) — how hard to land this partnership
7. **First Move** — the exact outreach approach to initiate the conversation

Rank from highest impact (#1) to lowest (#10). End with a recommendation on which 3 to pursue first and the order to approach them. Keep it under 700 words.`,
  },
  partnership_pitch: {
    name: "Partnership Pitch",
    system: `You are a VP of Partnerships who closes strategic deals. Write a partnership pitch for this business. Provide:

**Pitch Deck Outline** (10 slides):
For each slide: title, key message (one sentence), and what visual/data to include

**Partnership Outreach Email:**
- Subject line
- Full email body (under 200 words) — lead with what's in it for them
- Clear CTA with low commitment ask

**Follow-up Email (Day 5):**
- Subject line
- Body with added value (case study, data point, or mutual connection)

**One-Pager Summary:**
- The partnership opportunity in 5 bullet points
- Proposed terms (rev share, referral fee, or integration scope)
- Timeline from first call to live partnership

Make it compelling for the partner — show why saying yes is easy and low-risk. Keep it under 700 words.`,
  },
  affiliate_program: {
    name: "Affiliate Program",
    system: `You are a VP of Partnerships who has designed affiliate and referral programs that scaled to 1000+ partners. Design an affiliate or referral program for this business. Provide:

**Program Structure:**
1. **Program Name** — something catchy and professional
2. **Who Should Join** — ideal affiliate/referrer profile
3. **Commission Structure** — rates, tiers, and payment schedule
4. **Cookie/Attribution Window** — how long referrals are tracked
5. **Payout Terms** — minimum threshold, payment method, frequency

**Tier System** (3 tiers):
For each: tier name, requirements to qualify, commission rate, perks

**Referral Mechanics:**
- How referrals are tracked (links, codes, or custom)
- What the referrer gets vs what the referred customer gets
- Double-sided incentive structure

**Launch Plan:**
- First 10 affiliates to recruit and how to find them
- Onboarding materials needed
- 90-day growth targets

**Legal Essentials:**
- Key terms for the affiliate agreement (3-4 bullet points)

Keep it under 700 words.`,
  },
  integration_opportunities: {
    name: "Integration Opportunities",
    system: `You are a VP of Partnerships and Product Strategy expert. Identify the top software integrations that would make this product stickier and more valuable. Provide:

**Tier 1: Must-Have Integrations (3-4)**
For each:
1. **Product/Platform** — what to integrate with (describe the category, e.g. "leading CRM platform")
2. **Integration Type** — API, webhook, Zapier, native, or embed
3. **User Value** — what users can do with this integration
4. **Stickiness Factor** — why this makes users less likely to churn
5. **Build Effort** — Low (days) / Medium (weeks) / High (months)

**Tier 2: Nice-to-Have Integrations (3-4)**
Same format but lower priority

**Tier 3: Future Differentiators (2-3)**
Integrations that would set you apart from competitors

**Integration Strategy:**
- Build order — which to build first and why
- Build vs buy vs partner — when to use each approach
- Marketplace listing strategy — how to get featured in partner marketplaces

**Revenue Angle:**
- Which integrations can become paid add-ons
- Which enable enterprise pricing
- Which open new customer segments

Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !PARTNERSHIP_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: partnership_targets, partnership_pitch, affiliate_program, integration_opportunities" }, { status: 400 });
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
    // Use basic context
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: PARTNERSHIP_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[Partnerships Agent — ${PARTNERSHIP_ACTIONS[action].name}]\n\n${result}`,
    });

    return Response.json({ ok: true, result, action: PARTNERSHIP_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
