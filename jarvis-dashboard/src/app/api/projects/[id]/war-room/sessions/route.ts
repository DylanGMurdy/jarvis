import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { data, error } = await sb
    .from("war_room_sessions")
    .select("id, project_id, session_date, confidence_score, agents_run, summary_text, status, debate_status, conflict_count, escalation_count, total_rounds_completed, constraints_snapshot")
    .eq("project_id", id)
    .order("session_date", { ascending: false });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}
