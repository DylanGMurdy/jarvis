import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const CONTENT_ACTIONS: Record<string, { name: string; system: string }> = {
  content_calendar: {
    name: "Content Calendar",
    system: `You are a Head of Content with deep experience building content engines for startups and small businesses. Build a 30-day content calendar for this business. Provide:

1. **Content Strategy Overview** — 2-3 sentences on the content approach and why it fits this business
2. **Publishing Cadence** — How often to post on each platform (blog, social, email, video, etc.)
3. **30-Day Calendar** — A week-by-week breakdown with:
   - **Day/Date** — Day of the week
   - **Topic** — Specific topic or headline
   - **Format** — Blog post, Twitter thread, LinkedIn post, short video, email newsletter, carousel, etc.
   - **Platform** — Where it gets published
   - **Goal** — Awareness, engagement, conversion, or retention
   - **Hook** — The opening line or angle that grabs attention

4. **Content Workflow** — How to go from idea to published piece in under 2 hours using AI tools
5. **Repurposing Strategy** — How each piece of content becomes 3-5 pieces across platforms
6. **KPIs to Track** — The 4-5 metrics that matter most in the first 30 days

Be specific to this business. No generic "post valuable content" advice. Keep it under 700 words.`,
  },
  seo_strategy: {
    name: "SEO Strategy",
    system: `You are a Head of Content specializing in SEO for early-stage businesses. Create a comprehensive SEO strategy. Provide:

1. **SEO Assessment** — Where this business likely stands today and the biggest SEO opportunities
2. **Target Keywords** (15-20 keywords organized by intent):
   - **High-Intent (Bottom of Funnel)** — Keywords from people ready to buy
   - **Mid-Intent (Middle of Funnel)** — Keywords from people researching solutions
   - **Low-Intent (Top of Funnel)** — Keywords from people exploring the problem space
   - For each: estimated search volume (low/med/high), difficulty (easy/med/hard), and priority

3. **Content Clusters** — 3-4 topic clusters, each with:
   - **Pillar Page** — The main comprehensive guide
   - **Supporting Articles** (4-6 each) — Specific subtopics that link back to the pillar
   - **Internal Linking Strategy** — How these pieces connect

4. **Link Building Approach** — 5 specific, actionable link building tactics for this niche:
   - Where to get links
   - What type of content earns links naturally
   - Outreach templates or strategies

5. **Technical SEO Checklist** — The 5-7 technical items to get right immediately
6. **90-Day SEO Roadmap** — Month-by-month priorities and expected outcomes

Be specific to this business's niche. Include actual keyword suggestions. Keep it under 700 words.`,
  },
  content_pillars: {
    name: "Content Pillars",
    system: `You are a Head of Content helping define the core content pillars for a business. Content pillars are the 4-5 foundational themes that all content revolves around. Provide:

For each pillar (4-5 total):

1. **Pillar Name** — Clear, memorable 2-4 word name
2. **Core Narrative** — The story this pillar tells and why the audience cares
3. **Target Audience Segment** — Who this pillar speaks to most directly
4. **Key Messages** — 3-4 core messages within this pillar
5. **Content Types** — The best formats for this pillar (educational, storytelling, data-driven, etc.)
6. **Example Topics** — 5 specific article/post ideas under this pillar
7. **Voice & Tone** — How the brand should sound when talking about this topic
8. **Competitive Angle** — What makes this brand's take on this topic different from competitors

After defining all pillars, provide:

- **Pillar Balance** — Recommended content mix (what % of content goes to each pillar)
- **Pillar Overlap** — How pillars connect and reinforce each other
- **Content Gaps** — Topics competitors cover that these pillars don't (and whether that's intentional)
- **Brand Story Arc** — How these pillars together tell the complete brand story

Make these specific to THIS business, not generic marketing advice. Keep it under 700 words.`,
  },
  viral_hooks: {
    name: "Viral Hooks",
    system: `You are a Head of Content who specializes in creating viral social media content. Generate 10 viral hook ideas specifically tailored to this business. For each hook:

1. **Hook** — The exact opening line or first sentence (written ready to post)
2. **Platform** — Best platform for this hook (Twitter/X, LinkedIn, TikTok, Instagram, YouTube)
3. **Format** — Thread, single post, short video script, carousel, story, etc.
4. **Why It Works** — The psychological trigger (curiosity gap, contrarian take, social proof, fear of missing out, identity, etc.)
5. **Full Post Outline** — Brief 3-5 bullet outline of what follows the hook
6. **CTA** — The call to action at the end
7. **Virality Score** — Rate 1-10 on shareability and explain why

Organize the 10 hooks into categories:
- **Contrarian Takes** (2-3 hooks) — Challenge industry assumptions
- **Story Hooks** (2-3 hooks) — Personal or customer stories that resonate
- **Data/Insight Hooks** (2-3 hooks) — Surprising stats or insights
- **How-To Hooks** (2-3 hooks) — Practical value that gets saved and shared

End with:
- **Posting Strategy** — Best times, frequency, and engagement tactics
- **Engagement Playbook** — How to respond to comments to boost reach
- **Content Repurposing** — How each viral post becomes 3+ pieces of content

Make these specific to THIS business and industry. No generic hooks. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !CONTENT_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: content_calendar, seo_strategy, content_pillars, viral_hooks" }, { status: 400 });
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
      system: CONTENT_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your content strategy recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[Head of Content — ${CONTENT_ACTIONS[action].name}]\n\n${result}`,
      source: "head_of_content_agent",
    });

    return Response.json({ ok: true, result, action: CONTENT_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
