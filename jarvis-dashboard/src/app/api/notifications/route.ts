import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ data: [], unread: 0 });

  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ data: [], unread: 0, error: error.message }, { status: 500 });

  const unread = (data || []).filter((n: { read: boolean }) => !n.read).length;
  return Response.json({ data: data || [], unread });
}

export async function PATCH(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  if (body.markAllRead) {
    const { error } = await sb.from("notifications").update({ read: true }).eq("read", false);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (body.notificationId) {
    const { error } = await sb.from("notifications").update({ read: true }).eq("id", body.notificationId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "notificationId or markAllRead required" }, { status: 400 });
}
