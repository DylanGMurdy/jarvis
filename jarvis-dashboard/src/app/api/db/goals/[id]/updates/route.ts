import { getSupabase } from "@/lib/supabase";

// GET — list all updates for a goal
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { data, error } = await sb
    .from("goal_updates")
    .select("*")
    .eq("goal_id", id)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

// POST — log a new progress update for a goal
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const update = {
    id: crypto.randomUUID(),
    goal_id: id,
    note: body.note || "",
    progress: typeof body.progress === "number" ? body.progress : null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await sb.from("goal_updates").insert(update).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
