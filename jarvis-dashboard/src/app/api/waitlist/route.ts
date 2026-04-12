import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return Response.json({ ok: true, warning: "Supabase not configured" });
  }

  // Check for duplicate
  const { data: existing } = await sb
    .from("waitlist")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return Response.json({ ok: true, message: "You're already on the list!" });
  }

  const { error } = await sb.from("waitlist").insert({
    id: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    created_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, message: "You're on the waitlist!" });
}
