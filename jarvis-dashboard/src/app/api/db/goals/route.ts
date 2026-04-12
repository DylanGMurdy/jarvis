import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [], error: "Supabase not configured" });

  const { data, error } = await sb
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const goal = {
    id: crypto.randomUUID(),
    title: body.title || "",
    description: body.description || "",
    category: body.category || "business",
    progress: body.progress || 0,
    target: body.target || "",
    target_date: body.target_date || "",
    status: body.status || "On Track",
    project_id: body.project_id || null,
    milestones: body.milestones || [],
    weekly_breakdown: body.weekly_breakdown || [],
    progress_snapshots: body.progress_snapshots || [],
    created_at: new Date().toISOString(),
  };

  const { data, error } = await sb.from("goals").insert(goal).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
