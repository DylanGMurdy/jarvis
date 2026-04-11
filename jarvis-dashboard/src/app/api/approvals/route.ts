import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [], error: "Supabase not configured" });

  const { data, error } = await sb
    .from("approval_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { data, error } = await sb
    .from("approval_queue")
    .insert({
      project_id: body.project_id || null,
      project_title: body.project_title || null,
      action_type: body.action_type,
      description: body.description,
      payload: body.payload || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
