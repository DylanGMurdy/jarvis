import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

interface ProjectRow { id: string; title: string; status: string; grade: string; progress: number; revenue_goal: string; created_at: string }
interface NoteRow { project_id: string; content: string; created_at: string }
interface SessionRow { project_id: string; confidence_score: number; agents_run: number; summary_text: string; session_date: string }
interface TaskRow { project_id: string; title: string; done: boolean; updated_at?: string; created_at: string }

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sb = getSupabase();
  if (!sb) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Fetch all data in parallel
  const [projectsRes, notesRes, sessionsRes, tasksRes, mrrRes] = await Promise.all([
    sb.from("projects").select("id, title, status, grade, progress, revenue_goal, created_at"),
    sb.from("project_notes").select("project_id, content, created_at").gte("created_at", weekAgo).order("created_at", { ascending: false }),
    sb.from("war_room_sessions").select("project_id, confidence_score, agents_run, summary_text, session_date").gte("session_date", weekAgo),
    sb.from("project_tasks").select("project_id, title, done, created_at").gte("created_at", weekAgo),
    sb.from("revenue_settings").select("value").eq("key", "current_mrr").maybeSingle(),
  ]);

  const projects: ProjectRow[] = projectsRes.data || [];
  const notes: NoteRow[] = notesRes.data || [];
  const sessions: SessionRow[] = sessionsRes.data || [];
  const tasks: TaskRow[] = tasksRes.data || [];
  const mrr = mrrRes.data ? Number(mrrRes.data.value) || 0 : 0;

  // 2) Compute stats per project
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const projectActivity = new Map<string, { notes: number; sessions: number; tasksAdded: number; tasksDone: number }>();
  for (const n of notes) {
    const a = projectActivity.get(n.project_id) || { notes: 0, sessions: 0, tasksAdded: 0, tasksDone: 0 };
    a.notes++;
    projectActivity.set(n.project_id, a);
  }
  for (const s of sessions) {
    const a = projectActivity.get(s.project_id) || { notes: 0, sessions: 0, tasksAdded: 0, tasksDone: 0 };
    a.sessions++;
    projectActivity.set(s.project_id, a);
  }
  for (const t of tasks) {
    const a = projectActivity.get(t.project_id) || { notes: 0, sessions: 0, tasksAdded: 0, tasksDone: 0 };
    a.tasksAdded++;
    if (t.done) a.tasksDone++;
    projectActivity.set(t.project_id, a);
  }

  // 3) Aggregate agent activity counts
  const agentCounts = new Map<string, number>();
  for (const n of notes) {
    const match = n.content.match(/^\[(.+?)(?:\s*—|\])/);
    if (!match) continue;
    const agent = match[1].trim();
    if (agent === "Note" || agent.includes("Synced")) continue;
    agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
  }
  const topAgents = [...agentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Build context strings
  const projectActivitySummary = projects
    .map((p) => {
      const a = projectActivity.get(p.id);
      if (!a) return null;
      return `- ${p.title} [${p.status}, ${p.progress}%]: ${a.notes} agent actions, ${a.sessions} War Room runs, ${a.tasksDone}/${a.tasksAdded} tasks done`;
    })
    .filter(Boolean)
    .join("\n") || "No project activity this week.";

  const sessionsSummary = sessions.map((s) => {
    const title = projectMap.get(s.project_id)?.title || "Unknown";
    return `[${title}] Confidence ${s.confidence_score}/10, ${s.agents_run} agents:\n${s.summary_text.slice(0, 800)}`;
  }).join("\n\n---\n\n") || "No War Room sessions this week.";

  const agentSummary = topAgents.length > 0
    ? topAgents.map(([name, count]) => `- ${name}: ${count} actions`).join("\n")
    : "No agent activity this week.";

  // 4) Generate AI report
  let report = "Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env.local to generate AI reports.";
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: `You are JARVIS, Dylan Murdoch's AI Chief of Staff. Generate a comprehensive weekly business report. Use markdown formatting with these EXACT section headings:

# Weekly Report — ${dateStr}

## Executive Summary
[3-4 sentences capturing the most important takeaways from the week]

## Business Progress
[For each project with activity, write a paragraph: progress made, blockers, momentum. If a project had no activity, mention it briefly.]

## Agent Activity
[Summary of which agents worked the most and what they delivered. Highlight standout outputs.]

## Key Decisions Made
[Bullet list of important decisions or strategic moves observed in the data — War Room verdicts, status changes, priority shifts. If none are obvious, infer from patterns.]

## Next Week Priorities
[5 specific, actionable priorities ranked by impact. Each with a 1-sentence rationale.]

## Revenue Status
[Current MRR commentary, trajectory, and the single most important revenue-generating action for next week.]

Be specific, data-driven, and direct. Reference real project names and numbers. Avoid generic startup advice. Address Dylan as "you".`,
        messages: [{
          role: "user",
          content: `Generate this week's report from the following data:

DATE: ${dateStr}
TOTAL PROJECTS: ${projects.length}
MRR: $${mrr}

PROJECT ACTIVITY THIS WEEK:
${projectActivitySummary}

WAR ROOM SESSIONS (${sessions.length}):
${sessionsSummary}

AGENT ACTIVITY:
${agentSummary}

RAW STATS:
- Total agent actions: ${notes.length}
- Total tasks created: ${tasks.length}
- Total tasks completed: ${tasks.filter((t) => t.done).length}`,
        }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      report = textBlock && textBlock.type === "text" ? textBlock.text : report;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown";
      report = `Report generation failed: ${msg}`;
    }
  }

  // 5) Save to weekly_reports table
  let savedReportId: string | null = null;
  try {
    const { data: saved } = await sb.from("weekly_reports").insert({
      report_text: report,
      week_ending: new Date().toISOString(),
      stats: {
        projects: projects.length,
        actionsThisWeek: notes.length,
        warRoomRuns: sessions.length,
        tasksCompleted: tasks.filter((t) => t.done).length,
        mrr,
      },
    }).select().single();
    savedReportId = saved?.id || null;
  } catch { /* table may not exist */ }

  // Create a notification
  try {
    await sb.from("notifications").insert({
      title: "Weekly Report Ready",
      body: `Your week-ending ${dateStr} report is ready. ${notes.length} agent actions, ${sessions.length} War Room runs, ${tasks.filter((t) => t.done).length} tasks completed.`,
      type: "info",
      link: "/",
      read: false,
    });
  } catch { /* silent */ }

  return Response.json({
    ok: true,
    report,
    reportId: savedReportId,
    stats: {
      projects: projects.length,
      actionsThisWeek: notes.length,
      warRoomRuns: sessions.length,
      tasksCompleted: tasks.filter((t) => t.done).length,
      mrr,
    },
    generatedAt: new Date().toISOString(),
  });
}
