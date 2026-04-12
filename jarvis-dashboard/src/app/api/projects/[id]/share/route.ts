import { getSupabaseAdmin } from "@/lib/supabase";

// Generate or fetch existing share token
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseAdmin();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  // Reuse existing token if one exists
  const { data: existing } = await sb
    .from("project_shares")
    .select("token")
    .eq("project_id", id)
    .limit(1);

  if (existing && existing.length > 0) {
    return Response.json({ ok: true, token: existing[0].token });
  }

  // Generate a new token
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error } = await sb.from("project_shares").insert({
    token,
    project_id: id,
    created_at: new Date().toISOString(),
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, token });
}
