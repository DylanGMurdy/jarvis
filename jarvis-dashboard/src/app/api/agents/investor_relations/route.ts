import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "investor_update" | "pitch_deck_outline" | "cap_table_strategy" | "fundraising_timeline";

const SYSTEM_PROMPT = `You are the Investor Relations agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He's currently bootstrapping but thinks strategically about future fundraising. His businesses include custom Lindy AI agents for real estate agents ($750 setup + $97/mo) and a JARVIS AI command center.

Your role: Help Dylan communicate with potential investors and advisors like a seasoned founder. Write in a tone that's confident but honest — never oversell, always show traction with real numbers. Dylan's advantage is domain expertise in real estate + technical ability to ship fast.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  investor_update: (title, desc) => `Write a monthly investor update email for "${title}".

Project description: ${desc}

Format as a professional investor update email with:
1. **TL;DR** — 2-3 sentence summary of the month
2. **Key Metrics** — MRR, customer count, churn, growth rate (use placeholders like [X] for actual numbers)
3. **Wins** — top 3 accomplishments this month
4. **Challenges** — top 2 challenges and what's being done about them
5. **Product Updates** — what shipped and what's next
6. **Asks** — specific ways investors/advisors can help (intros, feedback, expertise)
7. **Looking Ahead** — top 3 priorities for next month

Keep it scannable — busy investors read in 60 seconds. Use bullet points, bold the important numbers.`,

  pitch_deck_outline: (title, desc) => `Create a full pitch deck outline for "${title}".

Project description: ${desc}

Provide slide-by-slide content for a 12-slide deck:

1. **Cover** — title, tagline, one-line description
2. **Problem** — the pain point, who feels it, how big it is
3. **Solution** — what the product does, hero screenshot description
4. **Market Size** — TAM, SAM, SOM with realistic numbers for this market
5. **Business Model** — how it makes money, pricing, unit economics
6. **Traction** — current metrics, growth trajectory, key milestones
7. **Product** — key features, tech stack, competitive advantages
8. **Competition** — landscape, positioning, unfair advantages
9. **Go-to-Market** — customer acquisition strategy, channels, CAC targets
10. **Team** — Dylan's background, why he's the right founder, advisory needs
11. **Financials** — 3-year projection, key assumptions, capital efficiency
12. **The Ask** — how much, what it funds, expected milestones with the capital

For each slide: key message, 3-5 bullet points of content, speaker notes.`,

  cap_table_strategy: (title, desc) => `Advise on cap table structure for "${title}".

Project description: ${desc}

Provide:
1. **Founding Equity** — recommended split if solo founder, how to handle future co-founders
2. **Option Pool** — recommended size, vesting schedule, when to create it
3. **Advisory Shares** — how much to give advisors, what to expect in return, vesting terms
4. **First Round Dilution** — what to expect giving up at pre-seed, seed, Series A
5. **Protective Provisions** — key terms to negotiate (anti-dilution, board seats, pro-rata)
6. **Cap Table Scenarios** — model at founding, post-angel, post-seed, post-Series A
7. **Mistakes to Avoid** — top 5 cap table mistakes first-time founders make
8. **Tools** — recommended cap table management software

Assume Dylan is sole founder, bootstrapping first, may raise later.`,

  fundraising_timeline: (title, desc) => `Build a fundraising timeline for "${title}".

Project description: ${desc}

Provide:
1. **Pre-Fundraising (Month 1-2)** — what to prepare before talking to investors
   - Metrics to hit, materials to create, story to craft
2. **Warm-Up (Month 3)** — building relationships before asking for money
   - How to get warm intros, which investors to target, coffee chat strategy
3. **Active Raise (Month 4-5)** — the fundraising sprint
   - How many meetings to target, follow-up cadence, pipeline management
4. **Term Sheet to Close (Month 6)** — closing the round
   - Negotiation tips, legal costs, timeline expectations
5. **Investor Targeting** — types of investors for this stage (angels, micro-VCs, syndicates)
   - 5 specific investor profiles to target with reasoning
6. **Materials Checklist** — everything Dylan needs ready before the first meeting
7. **Red Flags** — terms or investors to avoid
8. **Alternative: Revenue-Based Financing** — when to use Pipe, Clearco, etc. instead of equity`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: investor_update, pitch_deck_outline, cap_table_strategy, or fundraising_timeline" }, { status: 400 });
    }
    if (!projectId || !projectTitle) {
      return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });

    const claude = new Anthropic({ apiKey });
    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: ACTION_PROMPTS[action as Action](projectTitle, projectDescription || "No description") }],
    });

    const output = msg.content[0].type === "text" ? msg.content[0].text : "";

    const sb = getSupabaseAdmin();
    if (sb) {
      const labels: Record<Action, string> = { investor_update: "Investor Update", pitch_deck_outline: "Pitch Deck Outline", cap_table_strategy: "Cap Table Strategy", fundraising_timeline: "Fundraising Timeline" };
      await sb.from("project_notes").insert({
        id: `ir-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[Investor Relations — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
