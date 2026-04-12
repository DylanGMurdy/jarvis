import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { data, error } = await sb
    .from("project_milestones")
    .select("*")
    .eq("project_id", id)
    .order("target_date", { ascending: true });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { data, error } = await sb
    .from("project_milestones")
    .insert({
      id: crypto.randomUUID(),
      project_id: id,
      title: body.title,
      target_date: body.target_date || null,
      completed: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function PATCH(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { milestoneId, ...updates } = await request.json();
  if (!milestoneId) return Response.json({ error: "milestoneId required" }, { status: 400 });

  const { error } = await sb.from("project_milestones").update(updates).eq("id", milestoneId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { milestoneId } = await request.json();
  if (!milestoneId) return Response.json({ error: "milestoneId required" }, { status: 400 });

  const { error } = await sb.from("project_milestones").delete().eq("id", milestoneId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
