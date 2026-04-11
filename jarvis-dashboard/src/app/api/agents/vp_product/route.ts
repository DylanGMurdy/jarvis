import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "product_vision" | "feature_roadmap" | "user_personas" | "competitive_analysis";

const SYSTEM_PROMPT = `You are the VP of Product agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He ships fast, values simplicity over perfection, and builds for real users he talks to daily.

Your role: Define what gets built and why. Focus on outcomes, not features. Think in terms of user problems solved, not technology. Prioritize ruthlessly — Dylan has limited dev time, so every feature must earn its place. Always ground recommendations in real user behavior and willingness to pay.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  product_vision: (title, desc) => `Write a clear product vision and mission statement for "${title}".

Project description: ${desc}

Provide:
1. **Vision Statement** — one sentence describing the world this product creates (aspirational, 3-5 year horizon)
2. **Mission Statement** — one sentence describing what the product does for whom (concrete, present tense)
3. **Core Value Proposition** — the single most important reason someone pays for this
4. **North Star Metric** — the one number that best measures if the product is succeeding
5. **Product Principles** — 3-5 decision-making rules for what to build and what to skip
6. **Anti-Goals** — 3 things this product explicitly will NOT try to do
7. **Elevator Pitch** — 30-second pitch Dylan can use at any networking event`,

  feature_roadmap: (title, desc) => `Create a prioritized 90-day feature roadmap for "${title}".

Project description: ${desc}

Use RICE scoring (Reach × Impact × Confidence / Effort) for each feature.

Provide:
1. **Month 1 (MVP)** — 3-5 features needed to launch and get first paying customer
2. **Month 2 (Growth)** — 3-5 features to improve retention and get word-of-mouth
3. **Month 3 (Scale)** — 3-5 features to increase ARPU or reduce churn

For each feature:
- **Name** and one-line description
- **RICE Score** — Reach (1-10), Impact (1-3), Confidence (0.5-1.0), Effort (person-weeks)
- **User Story** — "As a [user], I want [thing] so I can [outcome]"
- **Success Metric** — how to know it worked

End with a **Cut List** — features that seem obvious but should NOT be built in the first 90 days, and why.`,

  user_personas: (title, desc) => `Define 3 detailed user personas for "${title}".

Project description: ${desc}

For each persona provide:
1. **Name and Title** — realistic name and job title
2. **Demographics** — age, location, income, tech comfort level
3. **Day in the Life** — what their typical workday looks like
4. **Goals** — what they're trying to achieve (3 specific goals)
5. **Pain Points** — what frustrates them today (3 specific pains)
6. **Current Solutions** — what they use now and why it falls short
7. **Willingness to Pay** — price sensitivity, how they budget for tools
8. **Decision Process** — how they evaluate and buy new tools
9. **Trigger Event** — what specific moment makes them search for a solution
10. **Objections** — top 2 reasons they'd say no, and how to overcome them

Make personas specific to the Utah real estate market where relevant. Include one ideal customer, one stretch customer, and one anti-persona (who this is NOT for).`,

  competitive_analysis: (title, desc) => `Analyze 3-5 direct competitors for "${title}".

Project description: ${desc}

For each competitor provide:
1. **Name and URL** — real company
2. **What They Do** — one-line description
3. **Pricing** — their pricing model and tiers
4. **Strengths** — what they do well (2-3 points)
5. **Weaknesses** — where they fall short (2-3 points)
6. **Target Customer** — who they primarily serve

Then provide:
- **Feature Comparison Matrix** — key features across all competitors (has/doesn't have)
- **Positioning Gaps** — 2-3 opportunities where no competitor serves the market well
- **Dylan's Unfair Advantage** — why this project can win against these competitors specifically
- **Positioning Statement** — "For [target] who [need], ${title} is the [category] that [key benefit] unlike [alternatives] because [reason]"`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: product_vision, feature_roadmap, user_personas, or competitive_analysis" }, { status: 400 });
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
        product_vision: "Product Vision",
        feature_roadmap: "Feature Roadmap",
        user_personas: "User Personas",
        competitive_analysis: "Competitive Analysis",
      };
      await sb.from("project_notes").insert({
        id: `vp-product-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[VP Product — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
