import { getSupabase } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  if (!body.status || !["approved", "rejected"].includes(body.status)) {
    return Response.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const { error } = await sb
    .from("approval_queue")
    .update({ status: body.status })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
