import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [], count: 0 });

  // Get agent-generated notes from last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: notes, error } = await sb
    .from("project_notes")
    .select("id, project_id, content, created_at")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ data: [], count: 0, error: error.message }, { status: 500 });

  // Filter to agent-generated notes (have [Agent — Action] prefix)
  const agentNotes = (notes || []).filter((n: { content: string }) =>
    /^\[.+?(Agent|War Room|VP |Head of|CSO|CMO|CFO|CTO|COO|CLO|CHRO|SDR|Partnerships|Data Analytics|Customer Success|Investor Relations|Recruiting)/.test(n.content)
  );

  // Fetch project titles for context
  const projectIds = [...new Set(agentNotes.map((n: { project_id: string }) => n.project_id))];
  let projectMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await sb
      .from("projects")
      .select("id, title")
      .in("id", projectIds);
    if (projects) {
      projectMap = Object.fromEntries(projects.map((p: { id: string; title: string }) => [p.id, p.title]));
    }
  }

  const activity = agentNotes.map((n: { id: string; project_id: string; content: string; created_at: string }) => {
    // Parse agent name and action from content like "[CFO Agent — Revenue Model]\n\nContent..."
    const headerMatch = n.content.match(/^\[(.+?)(?:\s*—\s*(.+?))?\]\s*\n/);
    const agentName = headerMatch ? headerMatch[1] : "Agent";
    const actionName = headerMatch?.[2] || "";
    // Get first meaningful line of content after the header
    const contentStart = n.content.indexOf("\n\n");
    const preview = contentStart > -1
      ? n.content.slice(contentStart + 2, contentStart + 102).replace(/\n/g, " ").trim()
      : n.content.slice(0, 100);

    return {
      id: n.id,
      agent: agentName,
      action: actionName,
      preview,
      project: projectMap[n.project_id] || "Unknown Project",
      project_id: n.project_id,
      created_at: n.created_at,
    };
  });

  return Response.json({ data: activity, count: activity.length });
}
