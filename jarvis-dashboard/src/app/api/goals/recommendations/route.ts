import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  // Fetch all projects, existing goals, and recent agent activity
  const [projectsRes, goalsRes, notesRes] = await Promise.all([
    sb.from("projects").select("title, status, grade, progress, revenue_goal, description, war_room_summary").order("grade", { ascending: true }),
    sb.from("goals").select("title, progress, status, target_date"),
    sb.from("project_notes").select("content, source").order("created_at", { ascending: false }).limit(20),
  ]);

  const projects = projectsRes.data || [];
  const existingGoals = goalsRes.data || [];
  const recentNotes = notesRes.data || [];

  const projectsContext = projects.map((p: { title: string; status: string; grade: string; progress: number; revenue_goal: string; description: string }) =>
    `- ${p.title} [${p.status}, Grade ${p.grade}, ${p.progress}%]: ${p.description?.slice(0, 100) || ""}${p.revenue_goal ? ` | Goal: ${p.revenue_goal}` : ""}`
  ).join("\n") || "No projects yet.";

  const goalsContext = existingGoals.map((g: { title: string; progress: number; status: string }) =>
    `- ${g.title} (${g.progress}%, ${g.status})`
  ).join("\n") || "No existing goals.";

  const agentInsights = recentNotes
    .filter((n: { content: string }) => n.content.length > 50)
    .slice(0, 8)
    .map((n: { content: string }) => `- ${n.content.split("\n")[0].slice(0, 120)}`)
    .join("\n") || "No recent agent insights.";

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are JARVIS, Dylan Murdoch's AI Chief of Staff. Based on his current businesses and existing goals, recommend exactly 3 NEW 90-day goals he should add. These should be specific, measurable, time-bound, and complementary to his existing goals (don't duplicate).

Return ONLY valid JSON in this exact shape (no markdown fences):
{
  "recommendations": [
    {
      "title": "string — clear, specific, action-oriented",
      "description": "1-2 sentences explaining the goal and why it matters now",
      "target_days": number — typically 30, 60, or 90,
      "rationale": "1 sentence on which project/data this is based on",
      "suggested_status": "On Track"
    }
  ]
}`,
      messages: [{
        role: "user",
        content: `Recommend 3 new goals for Dylan based on:

ACTIVE PROJECTS:
${projectsContext}

EXISTING GOALS:
${goalsContext}

RECENT AGENT INSIGHTS:
${agentInsights}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { recommendations: [] };
    }

    return Response.json({ ok: true, recommendations: parsed.recommendations || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
