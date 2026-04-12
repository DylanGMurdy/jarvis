import { getSupabase } from "@/lib/supabase";

interface NoteRow { project_id: string; content: string; created_at: string }

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [], mvp: null });

  // Pull all agent-generated notes (anything with [Agent — ...] header)
  const { data: notes } = await sb
    .from("project_notes")
    .select("project_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  const allNotes: NoteRow[] = (notes || []).filter((n: NoteRow) =>
    /^\[.+?(Agent|War Room|VP |Head of|CSO|CMO|CFO|CTO|COO|CLO|CHRO|SDR|Partnerships|Data Analytics|Customer Success|Investor Relations|Recruiting)/.test(n.content)
  );

  // Aggregate stats per agent
  interface AgentStat {
    agent: string;
    totalActions: number;
    projects: Set<string>;
    mostRecent: string;
    totalLength: number;
    actionsThisWeek: number;
  }
  const map = new Map<string, AgentStat>();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const n of allNotes) {
    const match = n.content.match(/^\[(.+?)(?:\s*—|\])/);
    if (!match) continue;
    const agent = match[1].trim();
    if (agent === "Note" || agent.includes("Synced")) continue;

    let stat = map.get(agent);
    if (!stat) {
      stat = { agent, totalActions: 0, projects: new Set(), mostRecent: n.created_at, totalLength: 0, actionsThisWeek: 0 };
      map.set(agent, stat);
    }
    stat.totalActions++;
    stat.projects.add(n.project_id);
    stat.totalLength += n.content.length;
    if (new Date(n.created_at).getTime() > new Date(stat.mostRecent).getTime()) {
      stat.mostRecent = n.created_at;
    }
    if (new Date(n.created_at).getTime() > weekAgo) {
      stat.actionsThisWeek++;
    }
  }

  const stats = [...map.values()]
    .map((s) => ({
      agent: s.agent,
      totalActions: s.totalActions,
      projectsCount: s.projects.size,
      mostRecent: s.mostRecent,
      avgLength: Math.round(s.totalLength / s.totalActions),
      actionsThisWeek: s.actionsThisWeek,
    }))
    .sort((a, b) => b.totalActions - a.totalActions);

  // Most Valuable Agent this week (most actions in last 7 days, tie-breaker: avg length)
  const weeklyRanking = [...stats].sort((a, b) => {
    if (b.actionsThisWeek !== a.actionsThisWeek) return b.actionsThisWeek - a.actionsThisWeek;
    return b.avgLength - a.avgLength;
  });
  const mvp = weeklyRanking[0] && weeklyRanking[0].actionsThisWeek > 0 ? weeklyRanking[0] : null;

  return Response.json({
    data: stats,
    mvp,
    totalAgents: stats.length,
    totalActions: allNotes.length,
  });
}
