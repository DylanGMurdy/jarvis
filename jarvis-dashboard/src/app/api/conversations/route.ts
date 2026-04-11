import { getSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const type = searchParams.get("type"); // "global" | "project" | null (all)

  let query = sb
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("conversation_type", type);
  }

  const { data, error } = await query;

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { messages, summary, title, conversation_type } = await request.json();

  const { data, error } = await sb
    .from("conversations")
    .insert({
      messages: messages || [],
      summary: summary || "",
      title: title || summary || "",
      conversation_type: conversation_type || "global",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function PATCH(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { id, ...updates } = await request.json();
  if (!id) return Response.json({ error: "Missing conversation id" }, { status: 400 });

  // Always update updated_at
  const { data, error } = await sb
    .from("conversations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function DELETE(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Missing conversation id" }, { status: 400 });

  const { error } = await sb
    .from("conversations")
    .delete()
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
