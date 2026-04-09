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
