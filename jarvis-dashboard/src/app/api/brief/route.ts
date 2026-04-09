import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json({ brief: null, error: "API key not configured" });
  }

  const sb = getSupabase();

  // Gather context from all sources
  let memoriesContext = "";
  let projectsContext = "";
  let goalsContext = "";
  let lindyContext = "";

  if (sb) {
    // Recent memories
    const { data: memories } = await sb
      .from("memories")
      .select("fact, category")
      .order("created_at", { ascending: false })
      .limit(20);

    if (memories && memories.length > 0) {
      memoriesContext = "\nRECENT MEMORIES:\n" + memories.map((m) => `- [${m.category}] ${m.fact}`).join("\n");
    }

    // Active projects
    const { data: projects } = await sb
      .from("projects")
      .select("title, status, progress, grade")
      .order("grade", { ascending: true });

    if (projects && projects.length > 0) {
      projectsContext = "\nACTIVE PROJECTS:\n" + projects.map((p) => `- ${p.title} (${p.status}, ${p.progress}%, Grade ${p.grade})`).join("\n");
    }

    // Goals
    const { data: goals } = await sb
      .from("goals")
      .select("title, progress, target_date");

    if (goals && goals.length > 0) {
      goalsContext = "\n90-DAY GOALS:\n" + goals.map((g) => `- ${g.title}: ${g.progress}% (target: ${g.target_date})`).join("\n");
    }

    // Latest Lindy update
    const { data: lindy } = await sb
      .from("lindy_updates")
      .select("summary, emails_handled, tasks_completed, flags")
      .order("created_at", { ascending: false })
      .limit(1);

    if (lindy && lindy.length > 0) {
      const l = lindy[0];
      lindyContext = `\nLATEST LINDY UPDATE:\n- ${l.summary}\n- Emails: ${l.emails_handled}, Tasks: ${l.tasks_completed}`;
      if (l.flags && l.flags.length > 0) {
        lindyContext += `\n- FLAGS: ${l.flags.join(", ")}`;
      }
    }
  }

  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: `You are JARVIS, Dylan's AI Chief of Staff. Generate a concise ${timeOfDay} briefing. Be direct, strategic, slightly witty. Call him "sir" once. Format with short bullet points. Include:
1. A one-line greeting with the date
2. Top priority for today (based on project grades and progress)
3. Quick goal check-in (which goal needs attention)
4. Any flags or blockers from agents
5. One motivational closer

Keep it under 200 words. No markdown headers — just clean text with bullet points.`,
      messages: [{
        role: "user",
        content: `Generate Dylan's ${timeOfDay} brief for ${dateStr}.${memoriesContext}${projectsContext}${goalsContext}${lindyContext}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return Response.json({ brief: textBlock ? textBlock.text : null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ brief: null, error: msg });
  }
}
