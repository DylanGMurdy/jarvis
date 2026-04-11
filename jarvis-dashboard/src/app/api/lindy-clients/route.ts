import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [], error: "Supabase not configured" });

  const { data, error } = await sb
    .from("lindy_clients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return Response.json({ data: [], error: error.message }, { status: 500 });
  return Response.json({ data: data || [] });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const { data, error } = await sb
    .from("lindy_clients")
    .insert({
      name: body.name,
      setup_paid: body.setup_paid ?? false,
      monthly_active: body.monthly_active ?? false,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
