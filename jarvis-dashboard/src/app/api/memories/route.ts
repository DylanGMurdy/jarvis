import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET — fetch all memories (or top N most recent)
export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ memories: [], error: "Supabase not configured" });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "200");
  const category = searchParams.get("category");

  let query = supabase
    .from("memories")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ memories: [], error: error.message }, { status: 500 });
  }

  return Response.json({ memories: data || [] });
}

// POST — add a new memory manually
export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { fact, category, source, confidence } = await request.json();

  if (!fact || !category) {
    return Response.json({ error: "fact and category required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("memories")
    .insert({
      fact,
      category,
      source: source || "manual",
      confidence: confidence || 1.0,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ memory: data });
}

// DELETE — remove a memory by id
export async function DELETE(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { id } = await request.json();

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase.from("memories").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
