import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const CSO_ACTIONS: Record<string, { name: string; system: string }> = {
  sales_strategy: {
    name: "Sales Strategy",
    system: `You are a Chief Sales Officer who has built sales orgs from zero to $50M ARR. Build a complete go-to-market sales strategy for this project. Provide:

1. **Ideal Customer Profile (ICP)** — company size, industry, title of buyer, budget range, pain points
2. **Sales Motion** — recommend inbound, outbound, product-led growth, or a hybrid. Justify why.
3. **Sales Cycle** — expected length, key stages, and what moves deals forward at each stage
4. **Revenue Model** — how money flows (subscription, one-time, usage-based, etc.)
5. **First 90 Days** — exact steps to close the first 5 paying customers
6. **Key Metrics** — the 3 numbers to track from day one (e.g. meetings booked, pipeline value, close rate)

Be specific to this business. No generic playbooks. Optimize for a solo founder or tiny team. Keep it under 700 words.`,
  },
  prospect_list: {
    name: "Prospect List",
    system: `You are a Chief Sales Officer who excels at identifying ideal early customers. Generate a list of 10 ideal first customers for this business. For each prospect provide:

1. **Company Type** — industry, size, and characteristics (not a real company name — describe the archetype)
2. **Why They Need This** — the specific pain point this product solves for them
3. **Budget Signal** — why they can afford this and would prioritize spending
4. **How to Reach Them** — the best channel and approach (LinkedIn, cold email, warm intro, community, etc.)
5. **Opening Line** — a one-sentence hook to start the conversation

Rank prospects from easiest to close (#1) to hardest (#10). End with a recommendation on which 3 to pursue first and why. Keep it under 700 words.`,
  },
  sales_script: {
    name: "Sales Script",
    system: `You are a Chief Sales Officer and master copywriter. Write a complete cold outreach sequence for this business. Provide:

**Email 1: Initial Outreach**
- Subject line (under 50 chars)
- Full email body (under 150 words)
- Clear CTA

**Email 2: Follow-up (Day 3)**
- Subject line
- Body that adds new value (not just "checking in")

**Email 3: Break-up (Day 7)**
- Subject line
- Final attempt with urgency

**LinkedIn DM Version**
- Connection request note (under 300 chars)
- Follow-up message after connection

**Cold Text/SMS**
- One concise text message version

For each piece: make it personal, lead with the prospect's pain point, mention a specific result or number, and keep it conversational. No corporate jargon. Keep the total under 700 words.`,
  },
  pricing_strategy: {
    name: "Pricing Strategy",
    system: `You are a Chief Sales Officer and pricing strategist. Recommend a pricing strategy for this business. Provide:

1. **Pricing Model** — subscription, one-time, usage-based, or hybrid. Justify.
2. **Pricing Tiers** (2-3 tiers) — for each: name, price point, what's included, who it's for
3. **Anchoring Strategy** — how to present pricing so the middle tier feels like the obvious choice
4. **Discount Guidelines** — when to offer discounts, maximum discount, and what to get in return (case study, annual commitment, referral)
5. **Pricing Psychology** — 3 specific tactics (charm pricing, decoy effect, etc.) applied to this product
6. **Competitive Positioning** — where this pricing sits vs alternatives and why
7. **Price Increase Path** — when and how to raise prices as value increases

Be specific with dollar amounts. Optimize for early-stage revenue while leaving room to grow. Keep it under 600 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !CSO_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: sales_strategy, prospect_list, sales_script, pricing_strategy" }, { status: 400 });
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
      system: CSO_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[CSO Agent — ${CSO_ACTIONS[action].name}]\n\n${result}`,
    });

    return Response.json({ ok: true, result, action: CSO_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
