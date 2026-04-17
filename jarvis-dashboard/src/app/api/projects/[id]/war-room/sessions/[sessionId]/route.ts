import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id: projectId, sessionId } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  // Fetch everything in parallel
  const [sessionRes, positionsRes, conflictsRes, messagesRes] = await Promise.all([
    sb.from("war_room_sessions").select("*").eq("id", sessionId).eq("project_id", projectId).single(),
    sb.from("war_room_agent_positions").select("*").eq("session_id", sessionId).order("round, agent_tier, agent_name"),
    sb.from("war_room_conflicts").select("*").eq("session_id", sessionId).order("created_at"),
    sb.from("war_room_debate_messages").select("*").eq("session_id", sessionId).order("round, created_at"),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({
    session: sessionRes.data,
    positions: positionsRes.data || [],
    conflicts: conflictsRes.data || [],
    debate_messages: messagesRes.data || [],
  });
}
