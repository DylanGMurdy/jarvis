import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const sb = getSupabase();

  try {
    const body = await request.json();

    const update = {
      summary: body.summary || "",
      emails_handled: body.emails_handled || 0,
      tasks_completed: body.tasks_completed || 0,
      flags: body.flags || [],
      raw_payload: body,
      created_at: new Date().toISOString(),
    };

    if (sb) {
      const { data, error } = await sb
        .from("lindy_updates")
        .insert(update)
        .select()
        .single();

      if (error) {
        console.log("[Lindy update] Supabase error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ ok: true, id: data.id });
    }

    // Fallback if Supabase not configured
    return Response.json({ ok: true, id: crypto.randomUUID(), warning: "Supabase not configured — update not persisted" });
  } catch (err) {
    console.log("[Lindy update] Error:", err);
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  const sb = getSupabase();

  if (sb) {
    const { data, error } = await sb
      .from("lindy_updates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    const { count } = await sb
      .from("lindy_updates")
      .select("*", { count: "exact", head: true });

    if (error) return Response.json({ latest: null, total: 0 });

    return Response.json({
      latest: data && data.length > 0 ? data[0] : null,
      total: count || 0,
    });
  }

  return Response.json({ latest: null, total: 0 });
}
