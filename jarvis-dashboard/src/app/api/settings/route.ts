import { getSupabase } from "@/lib/supabase";

// GET — load all settings
export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: {} });

  const { data, error } = await sb
    .from("revenue_settings")
    .select("key, value");

  if (error) return Response.json({ data: {} });

  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }
  return Response.json({ data: settings });
}

// PUT — save one or more key-value pairs
export async function PUT(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body: Record<string, string> = await request.json();
  const entries = Object.entries(body);

  for (const [key, value] of entries) {
    await sb
      .from("revenue_settings")
      .upsert({ key, value: String(value) }, { onConflict: "key" });
  }

  return Response.json({ ok: true });
}
