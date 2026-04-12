import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json({ ok: false, error: "API key not configured" }, { status: 500 });
  }

  const sb = getSupabase();
  if (!sb) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  // 1) Fetch all active projects
  const { data: projects } = await sb
    .from("projects")
    .select("title, status, progress, grade, category, revenue_goal")
    .order("grade", { ascending: true });

  // 2) Fetch pending approval queue items
  const { data: approvals } = await sb
    .from("approval_queue")
    .select("action_type, description, project_title, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // 3) Fetch notifications from last 24 hours (project_notes with agent sources as activity log)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNotes } = await sb
    .from("project_notes")
    .select("content, source, created_at")
    .gte("created_at", yesterday)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch MRR
  const { data: mrrData } = await sb
    .from("revenue_settings")
    .select("value")
    .eq("key", "current_mrr")
    .single();

  // Fetch goals
  const { data: goals } = await sb
    .from("goals")
    .select("title, progress, target_date");

  // Fetch recent tasks completed
  const { data: recentTasks } = await sb
    .from("project_tasks")
    .select("title, done")
    .eq("done", true)
    .order("updated_at", { ascending: false })
    .limit(10);

  // Build context
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const mrr = mrrData ? Number(mrrData.value) || 0 : 0;
  const pendingCount = approvals?.length || 0;

  const projectsList = (projects || [])
    .map((p) => `- ${p.title} [${p.status}] — ${p.progress}% done, Grade ${p.grade}${p.revenue_goal ? `, goal: $${p.revenue_goal}` : ""}`)
    .join("\n") || "No active projects.";

  const approvalsList = (approvals || [])
    .map((a) => `- [${a.action_type}] ${a.description}${a.project_title ? ` (${a.project_title})` : ""}`)
    .join("\n") || "None pending.";

  const agentActivity = (recentNotes || [])
    .filter((n) => n.source && n.source !== "manual")
    .map((n) => {
      const sourceName = n.source.replace(/_agent$/, "").replace(/_/g, " ").toUpperCase();
      const preview = n.content.split("\n")[0].slice(0, 100);
      return `- ${sourceName}: ${preview}`;
    })
    .join("\n") || "No agent activity in the last 24 hours.";

  const goalsList = (goals || [])
    .map((g) => `- ${g.title}: ${g.progress}% (target: ${g.target_date})`)
    .join("\n") || "No goals set.";

  const completedTasks = (recentTasks || [])
    .map((t) => `- ${t.title}`)
    .join("\n") || "No tasks completed recently.";

  // 4) Call Anthropic to generate the briefing
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are JARVIS, Dylan Murdoch's AI Chief of Staff. Generate a crisp, professional morning briefing. Use exactly this structure:

Good morning Dylan. Here is your Jarvis briefing for ${dateStr}.

**Active Businesses:** [List each project with its status and grade in a compact format]

**Pending Approvals:** [Count] items need your review. [Brief summary of what they are if any exist]

**Top Priority Today:** [Identify the single most urgent/impactful item based on project grades, deadlines, and pending approvals. Be specific and actionable.]

**Agent Activity Overnight:** [Summarize what agents did in the last 24 hours. If multiple agents ran, give a count and highlight the most important outputs.]

**Revenue Status:** MRR is $${mrr}. [Brief commentary on trajectory or next milestone.]

**90-Day Goals Check:** [Quick status on goals — which is on track, which needs attention]

End with one sharp, motivational line. Keep the whole briefing under 300 words. Be direct, no fluff. Call him "sir" once naturally.`,
      messages: [{
        role: "user",
        content: `Generate the morning briefing with this data:

DATE: ${dateStr}
MRR: $${mrr}

ACTIVE PROJECTS:
${projectsList}

PENDING APPROVALS (${pendingCount}):
${approvalsList}

AGENT ACTIVITY (last 24h):
${agentActivity}

90-DAY GOALS:
${goalsList}

RECENTLY COMPLETED TASKS:
${completedTasks}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const briefing = textBlock && textBlock.type === "text" ? textBlock.text : "Unable to generate briefing.";

    // 5) Save the briefing as a memory so it persists across sessions
    try {
      await sb.from("memories").insert({
        fact: briefing.slice(0, 500),
        category: "business",
        source: "jarvis_briefing",
        confidence: 1.0,
      });
    } catch {
      // Non-critical — briefing still returned even if save fails
    }

    // 6) Return the briefing
    return Response.json({ ok: true, briefing });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
