import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "daily_briefing" | "assign_tasks" | "weekly_review" | "escalate";

const SYSTEM_PROMPT = `You are the Master Orchestrator agent for JARVIS — Dylan Murdoch's AI-powered PE business empire command center.

You sit above all other agents in the org chart. Your job is to see the full picture across ALL businesses and projects, identify what matters most RIGHT NOW, and direct Dylan's limited time to maximum impact.

Dylan runs multiple businesses from Eagle Mountain, Utah: custom Lindy AI agents for RE agents, Narwhal Homes real estate sales, and the JARVIS platform itself. He has 3-4 focused work hours per day and family time is sacred (6-8pm daily).

Your role: Be the chief of staff who makes sure nothing falls through the cracks. Prioritize ruthlessly. Escalate only what truly needs Dylan's attention. Everything else should be delegated to the right agent or automated. Think like a high-performance executive assistant who understands business strategy.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  daily_briefing: (title, desc) => `Compile a morning briefing for Dylan about "${title}".

Project description: ${desc}

Format as a crisp daily briefing:

1. **Status Check** — current project status, progress percentage, and momentum (accelerating/steady/stalling)
2. **Yesterday's Progress** — what happened in the last 24 hours (based on recent notes and tasks)
3. **Today's Top 3** — the three most important things to focus on today, in priority order
4. **Blockers** — anything preventing progress, and suggested resolution
5. **Agent Recommendations** — which War Room agents should be run today and why
6. **Quick Wins** — 1-2 things that can be done in under 15 minutes for outsized impact
7. **Calendar Awareness** — what day of the week it is, any timing considerations
8. **Energy Level Match** — tag each task as Deep Work, Light Work, or Can Be Automated

Keep it scannable. Dylan reads this with morning coffee — max 2 minutes to read.`,

  assign_tasks: (title, desc) => `Analyze "${title}" and assign the right tasks to the right agents.

Project description: ${desc}

Based on the project's current stage and needs, determine:

1. **Project Assessment** — current stage, maturity, and biggest gaps
2. **Agent Assignments** — for each relevant agent, what specific task they should run:
   - CFO → which financial analysis is most needed now?
   - COO → which operational analysis is most urgent?
   - VP Product → what product decisions need to be made?
   - VP Engineering → what technical work should be planned?
   - CMO → what marketing actions should happen?
   - Head of CX → what customer experience work is needed?
   - VP Operations → what systems need to be built?
   - VP Sales → what sales activities should be prioritized?
3. **Priority Order** — sequence these assignments by impact (what unlocks the most value first)
4. **Skip List** — which agents are NOT needed right now, and why
5. **Dylan's Personal Tasks** — what only Dylan can do (can't be delegated to any agent)
6. **Timeline** — suggested order of execution across this week`,

  weekly_review: (title, desc) => `Run a weekly review for "${title}".

Project description: ${desc}

Provide a structured weekly review:

1. **Scorecard** — rate the week 1-10 with justification
2. **Wins** — top 3 accomplishments this week (celebrate these)
3. **Misses** — what didn't get done and why (be honest)
4. **Key Metrics Movement** — what moved up, down, or stayed flat
5. **Lessons Learned** — one insight from this week to carry forward
6. **Next Week Priorities** — top 5 priorities ranked by impact
7. **Risk Radar** — emerging risks that aren't urgent but need watching
8. **Resource Allocation** — is Dylan spending time on the right things? Suggest rebalancing if needed
9. **30-Day Outlook** — where will this project be in 30 days at current pace?
10. **Decision Queue** — decisions that need to be made soon (with recommended choice)

Be direct. Don't sugarcoat. Dylan values honest assessment over encouragement.`,

  escalate: (title, desc) => `Identify items that need Dylan's immediate attention for "${title}".

Project description: ${desc}

Evaluate and report:

1. **Critical Items** (act today) — things that will cause damage if not addressed in 24 hours
   - What, why it's critical, recommended action, time required
2. **Important Items** (act this week) — things that will slow progress if ignored
   - What, impact of delay, recommended action, time required
3. **Watch List** (monitor) — things that could become problems in 2-4 weeks
   - What, trigger condition, contingency plan
4. **False Urgencies** — things that feel urgent but actually aren't (don't get distracted)
5. **Delegation Opportunities** — items that feel like they need Dylan but can actually be handled by an agent or automation
6. **Decision Matrix** — for each critical item: options, pros/cons, recommended choice

Rules for escalation:
- Revenue at risk → always escalate
- Customer relationship at risk → always escalate
- Legal/compliance risk → always escalate
- Can be automated → never escalate
- Nice-to-have improvement → never escalate`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: daily_briefing, assign_tasks, weekly_review, or escalate" }, { status: 400 });
    }
    if (!projectId || !projectTitle) {
      return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });

    const sb = getSupabaseAdmin();

    // For the orchestrator, pull in extra context from the database
    let extraContext = "";
    if (sb) {
      const { data: recentNotes } = await sb
        .from("project_notes")
        .select("content, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: tasks } = await sb
        .from("project_tasks")
        .select("title, done")
        .eq("project_id", projectId)
        .limit(30);

      if (recentNotes?.length) {
        extraContext += "\n\nRecent project notes:\n" + recentNotes.map((n: { content: string }) => `- ${n.content.slice(0, 300)}`).join("\n");
      }
      if (tasks?.length) {
        extraContext += "\n\nCurrent tasks:\n" + tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n");
      }
    }

    const claude = new Anthropic({ apiKey });
    const prompt = ACTION_PROMPTS[action as Action](projectTitle, (projectDescription || "No description") + extraContext);

    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const output = msg.content[0].type === "text" ? msg.content[0].text : "";

    if (sb) {
      const labels: Record<Action, string> = { daily_briefing: "Daily Briefing", assign_tasks: "Agent Assignments", weekly_review: "Weekly Review", escalate: "Escalation Report" };
      await sb.from("project_notes").insert({
        id: `orchestrator-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[Master Orchestrator — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
