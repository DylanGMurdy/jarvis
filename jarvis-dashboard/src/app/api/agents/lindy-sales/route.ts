import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

const LINDY_PROJECT_ID = "8f662ef5-df61-45fa-815b-0144739edf6f";

type Action = "find_leads" | "draft_outreach" | "generate_demo_script";

const SYSTEM_PROMPT = `You are a sales intelligence agent for Dylan Murdoch's Lindy AI agent business.

Dylan is a real estate agent in Eagle Mountain, Utah who sells custom Lindy AI agents to other real estate agents.
- Pricing: $750-1000 setup + $97/month recurring
- Target market: Real estate agents and brokerages in Utah
- Key value prop: Lindy agents handle email triage, lead follow-up, scheduling, and content generation — saving agents 10+ hours/week

Dylan's communication style:
- Friendly, casual, like a friend checking in — NOT salesy or robotic
- Leads with pain points, not features
- Uses real talk: "hey", "honestly", "real quick"
- Never pushy, never aggressive
- Speaks from experience as an agent who uses these tools himself`;

const ACTION_PROMPTS: Record<Action, string> = {
  find_leads: `Generate a list of 10 real estate brokerages or teams in Utah that would benefit most from Lindy AI agents. For each, provide:

1. **Company/Team Name** — real brokerage names operating in Utah
2. **Why They Need It** — specific pain point (high volume leads, solo agent stretched thin, team coordination, etc.)
3. **Contact Approach** — how Dylan should reach out (mutual connection, cold text, event, etc.)

Focus on small-to-mid brokerages (5-50 agents) where the decision-maker is accessible. Prioritize Utah County, Salt Lake County, and Davis County.`,

  draft_outreach: `Write 3 different outreach messages Dylan can send to real estate agents about Lindy AI agents:

1. **Cold Text Message** (under 160 chars) — casual, curiosity-driven, no pitch
2. **Warm Follow-Up Text** — for someone who showed interest, includes a specific benefit
3. **Email** — slightly longer, mentions specific pain points (email overload, lead follow-up falling through cracks, scheduling headaches), includes a soft CTA for a 5-min demo

Every message should sound like Dylan talking to a friend, not a marketing bot. Use his casual style. Reference his own experience as an agent.`,

  generate_demo_script: `Create a 5-minute demo script Dylan can use when showing Lindy to a prospect. Structure:

**Opening (30 sec):** Quick hook — "Let me show you what's been saving me 2 hours a day"

**Problem (1 min):** Paint the pain — emails piling up, leads going cold, scheduling back-and-forth

**Live Demo (2.5 min):** Walk through 3 things:
1. Email triage — show inbox getting sorted, drafts written
2. Lead follow-up — automatic check-ins that sound human
3. Calendar management — showings scheduled without the back-and-forth

**Close (1 min):** Pricing ($750 setup, $97/mo), ROI math (if it saves 1 deal = pays for itself for years), soft close

Keep it conversational. Dylan is showing this on his phone or laptop screen-share. Include what to click/show at each step.`,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as Action;

    if (!action || !ACTION_PROMPTS[action]) {
      return Response.json({ error: "Invalid action. Use: find_leads, draft_outreach, or generate_demo_script" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const claude = new Anthropic({ apiKey });

    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: ACTION_PROMPTS[action] }],
    });

    const output = msg.content[0].type === "text" ? msg.content[0].text : "";

    // Save to project notes
    const sb = getSupabaseAdmin();
    if (sb) {
      const labels: Record<Action, string> = {
        find_leads: "Lead List",
        draft_outreach: "Outreach Drafts",
        generate_demo_script: "Demo Script",
      };
      await sb.from("project_notes").insert({
        id: `lindy-sales-${action}-${Date.now()}`,
        project_id: LINDY_PROJECT_ID,
        content: `[Sales Agent — ${labels[action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, action, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
