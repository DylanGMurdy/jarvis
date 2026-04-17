import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ data: null });

  const { data, error } = await sb
    .from("project_constraints")
    .select("*")
    .eq("project_id", id)
    .maybeSingle();

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  let body: {
    budget_tier?: string;
    timeline?: string;
    strategic_role?: string;
    time_commitment?: string;
    success_criteria?: string;
    hard_constraints?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Upsert (one row per project)
  const { data, error } = await sb
    .from("project_constraints")
    .upsert(
      {
        project_id: id,
        budget_tier: body.budget_tier || null,
        timeline: body.timeline || null,
        strategic_role: body.strategic_role || null,
        time_commitment: body.time_commitment || null,
        success_criteria: body.success_criteria || null,
        hard_constraints: body.hard_constraints || null,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
