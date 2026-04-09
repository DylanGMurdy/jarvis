import { getSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [] });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");

  const { data, error } = await sb
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { messages, summary } = await request.json();

  const { data, error } = await sb
    .from("conversations")
    .insert({
      messages: messages || [],
      summary: summary || "",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
