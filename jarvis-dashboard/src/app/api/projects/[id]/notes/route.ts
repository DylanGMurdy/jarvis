import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { data, error } = await sb
    .from("project_notes")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const noteId = crypto.randomUUID();

  const { data, error } = await sb
    .from("project_notes")
    .insert({ id: noteId, project_id: id, content: body.content, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
