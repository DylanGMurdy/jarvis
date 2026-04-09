import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { data, error } = await sb
    .from("project_tasks")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const taskId = body.id || crypto.randomUUID();

  const { data, error } = await sb
    .from("project_tasks")
    .insert({ id: taskId, project_id: id, title: body.title, done: body.done ?? false, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function PATCH(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { taskId, ...updates } = await request.json();
  if (!taskId) return Response.json({ error: "taskId required" }, { status: 400 });

  const { error } = await sb.from("project_tasks").update(updates).eq("id", taskId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
