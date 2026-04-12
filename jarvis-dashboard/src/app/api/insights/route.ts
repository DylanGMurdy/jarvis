import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

interface ProjectRow { id: string; title: string; status: string; grade: string; progress: number; created_at: string; war_room_completed_at?: string | null }
interface NoteRow { project_id: string; content: string; created_at: string }

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  // Pull all projects
  const { data: projectsData } = await sb
    .from("projects")
    .select("id, title, status, grade, progress, created_at, war_room_completed_at");
  const projects: ProjectRow[] = projectsData || [];

  // Pull all notes from last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: notesData } = await sb
    .from("project_notes")
    .select("project_id, content, created_at")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false });
  const notes: NoteRow[] = notesData || [];

  // ─── Compute deterministic stats ──────────────────────
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Most momentum: project with most notes in last 7 days
  const projectNoteCounts = new Map<string, number>();
  const projectLastActivity = new Map<string, string>();
  for (const n of notes) {
    projectNoteCounts.set(n.project_id, (projectNoteCounts.get(n.project_id) || 0) + 1);
    if (!projectLastActivity.has(n.project_id) || new Date(n.created_at) > new Date(projectLastActivity.get(n.project_id)!)) {
      projectLastActivity.set(n.project_id, n.created_at);
    }
  }
  let mostActiveProject: { id: string; title: string; noteCount: number; lastActivity: string } | null = null;
  for (const [pid, count] of projectNoteCounts) {
    const p = projectMap.get(pid);
    if (!p) continue;
    if (!mostActiveProject || count > mostActiveProject.noteCount) {
      mostActiveProject = { id: pid, title: p.title, noteCount: count, lastActivity: projectLastActivity.get(pid) || "" };
    }
  }

  // Agent of the week: count notes per agent name parsed from header
  const agentCounts = new Map<string, number>();
  for (const n of notes) {
    const match = n.content.match(/^\[(.+?)(?:\s*—|\])/);
    if (!match) continue;
    const agent = match[1].trim();
    if (agent === "Note" || agent.includes("Synced")) continue;
    agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
  }
  const agentRanking = [...agentCounts.entries()].sort((a, b) => b[1] - a[1]);
  const agentOfWeek = agentRanking[0] ? { name: agentRanking[0][0], count: agentRanking[0][1] } : null;
  const topAgents = agentRanking.slice(0, 5).map(([name, count]) => ({ name, count }));

  // War Room runs in last 7 days
  const warRoomNotes = notes.filter((n) => /^\[War Room/.test(n.content));
  const warRoomProjectIds = new Set(warRoomNotes.map((n) => n.project_id));
  const totalNotesThisWeek = notes.length;

  // Pre-built context for AI
  const projectSummary = projects
    .map((p) => `- ${p.title} [${p.status}, Grade ${p.grade}, ${p.progress}%]: ${projectNoteCounts.get(p.id) || 0} agent actions this week`)
    .join("\n");

  const warRoomSamples = warRoomNotes.slice(0, 10).map((n) => {
    const project = projectMap.get(n.project_id)?.title || "Unknown";
    const preview = n.content.slice(0, 400);
    return `[${project}]\n${preview}`;
  }).join("\n\n---\n\n");

  // ─── Call Claude for insights ─────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let aiInsights: { topInsights: { title: string; body: string }[]; commonRisks: string[]; commonOpportunities: string[]; weeklySummary: string } = {
    topInsights: [],
    commonRisks: [],
    commonOpportunities: [],
    weeklySummary: "Add an Anthropic API key to generate AI insights.",
  };

  if (apiKey && projects.length > 0) {
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `You are JARVIS, Dylan's AI Chief of Staff, analyzing his entire business portfolio. Generate strategic insights from the data. Return ONLY valid JSON matching this schema:

{
  "topInsights": [
    { "title": "Short insight title (under 50 chars)", "body": "1-2 sentence actionable insight" }
  ],
  "commonRisks": ["Specific risk pattern observed across projects (under 80 chars each)"],
  "commonOpportunities": ["Specific opportunity pattern observed (under 80 chars each)"],
  "weeklySummary": "A 3-4 sentence executive summary of the week"
}

Provide exactly 3 topInsights, 3-5 commonRisks, 3-5 commonOpportunities. Be specific to the data — no generic startup advice. If War Room data is sparse, infer from project metadata.`,
        messages: [{
          role: "user",
          content: `Analyze this portfolio data:

PROJECTS (${projects.length}):
${projectSummary || "No active projects."}

ACTIVITY THIS WEEK:
- Total agent actions: ${totalNotesThisWeek}
- War Room runs across ${warRoomProjectIds.size} project(s)
- Most active agent: ${agentOfWeek?.name || "None"} (${agentOfWeek?.count || 0} actions)
- Top 5 agents: ${topAgents.map((a) => `${a.name} (${a.count})`).join(", ")}

WAR ROOM ANALYSIS SAMPLES:
${warRoomSamples || "No War Room runs this week."}

Return only the JSON object, no markdown code fences.`,
        }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
      // Strip code fences if present
      const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        aiInsights = JSON.parse(cleaned);
      } catch {
        aiInsights.weeklySummary = text.slice(0, 500);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown";
      aiInsights.weeklySummary = `AI analysis unavailable: ${msg}`;
    }
  }

  return Response.json({
    ok: true,
    stats: {
      totalProjects: projects.length,
      totalActionsThisWeek: totalNotesThisWeek,
      warRoomRunsThisWeek: warRoomProjectIds.size,
    },
    mostActiveProject,
    agentOfWeek,
    topAgents,
    insights: aiInsights,
    generatedAt: new Date().toISOString(),
  });
}
