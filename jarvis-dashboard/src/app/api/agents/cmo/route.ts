import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const CMO_ACTIONS: Record<string, { name: string; system: string }> = {
  market_analysis: {
    name: "Market Analysis",
    system: `You are a Chief Marketing Officer with 20 years of experience scaling startups. Analyze the market opportunity for this project. Provide:

1. **Market Size Estimate** — TAM, SAM, SOM with dollar figures and reasoning
2. **Target Audience** — Primary and secondary personas with demographics and pain points
3. **Top 3 Competitors** — Name each, their strengths, weaknesses, and how to differentiate
4. **Positioning Recommendation** — One clear positioning statement and the "wedge" to enter the market

Be specific and actionable. Use data-driven reasoning. Format with clear headers and bullet points. Keep it under 600 words.`,
  },
  content_strategy: {
    name: "Content Strategy",
    system: `You are a Chief Marketing Officer who has built content engines that drove millions in pipeline. Create a 30-day content strategy for this project. Provide:

**Week 1-4 breakdown**, each with:
- 3-4 specific content pieces (title + format: tweet thread, LinkedIn post, short video, blog, newsletter)
- The channel to publish on
- The messaging angle and hook
- Expected outcome (awareness, leads, authority)

End with:
- **Content Pillars** — 3 recurring themes to own
- **Posting Cadence** — how often per channel
- **Quick Win** — the single piece of content to publish first

Be specific to this business. No generic advice. Format with clear headers. Keep it under 700 words.`,
  },
  growth_channels: {
    name: "Growth Channels",
    system: `You are a Chief Marketing Officer and growth strategist. Identify the top 5 growth channels for this business. For each channel provide:

1. **Channel Name**
2. **Why It Fits** — specific reason this channel works for this business
3. **Effort Score** (1-5, where 1 = easy) — time, money, and skill required
4. **Impact Score** (1-5, where 5 = highest) — expected customer acquisition impact
5. **90-Day Play** — exactly what to do in the first 90 days on this channel
6. **Key Metric** — the one number to track

Rank channels by Impact/Effort ratio (best first). End with a recommendation on which 2 channels to start with and why. Be specific to this business. Keep it under 600 words.`,
  },
  brand_voice: {
    name: "Brand Voice",
    system: `You are a Chief Marketing Officer and brand strategist. Define the brand voice, tone, and messaging guidelines for this project. Provide:

1. **Brand Personality** — 3-5 adjectives that define the brand character
2. **Voice Attributes** — how the brand sounds (formal/casual, technical/simple, etc.) with examples
3. **Tone Spectrum** — how tone shifts across contexts (social media, sales, support, crisis)
4. **Messaging Framework**:
   - Tagline (5-8 words)
   - Elevator pitch (2 sentences)
   - Value propositions (3 bullets)
   - Key phrases to use / phrases to avoid
5. **Example Copy** — write one social media post and one cold outreach message in this voice

Be specific to this business and its target audience. Keep it under 600 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !CMO_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: market_analysis, content_strategy, growth_channels, brand_voice" }, { status: 400 });
  }

  if (!projectId || !projectTitle) {
    return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
  }

  // Fetch full project context if available
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
    // Use the basic context from request body
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: CMO_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    // Save to project notes
    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[CMO Agent — ${CMO_ACTIONS[action].name}]\n\n${result}`,
    });

    return Response.json({ ok: true, result, action: CMO_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
