import { getSupabase } from "@/lib/supabase";

function agentNameToSource(name: string): string {
  return "war_room_" + name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: routeProjectId } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  try {
    const body = await request.json();
    const projectId = body.projectId || routeProjectId;
    const agentName = body.agentName as string;
    const result = body.result as string;
    const role = (body.agentRole as string) || "";

    if (!projectId || !agentName || typeof result !== "string") {
      return Response.json({ ok: false, error: "projectId, agentName, and result are required" }, { status: 400 });
    }

    const source = agentNameToSource(agentName);
    const content = `[War Room — ${agentName}${role ? ` (${role})` : ""}]\n\n${result}`;

    // Upsert: delete any prior row for this project+source, then insert fresh
    await sb.from("project_notes").delete().eq("project_id", projectId).eq("source", source);
    const { error } = await sb.from("project_notes").insert({
      project_id: projectId,
      content,
      source,
      created_at: new Date().toISOString(),
    });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
