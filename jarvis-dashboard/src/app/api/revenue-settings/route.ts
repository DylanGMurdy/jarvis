import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: { current_mrr: 0 }, error: "Supabase not configured" });

  const { data, error } = await sb
    .from("revenue_settings")
    .select("*")
    .eq("key", "current_mrr")
    .single();

  if (error || !data) return Response.json({ data: { current_mrr: 0 } });
  return Response.json({ data: { current_mrr: Number(data.value) || 0 } });
}

export async function PUT(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const mrr = Number(body.current_mrr) || 0;

  const { error } = await sb
    .from("revenue_settings")
    .upsert({ key: "current_mrr", value: String(mrr) }, { onConflict: "key" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data: { current_mrr: mrr } });
}
