import { getSupabase } from "@/lib/supabase";

// POST /api/projects/[id]/progress
// Accepts: { update: string, progress?: number, status?: string }
// Called by Claude Code to report build progress back to the dashboard
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { update, progress, status } = await request.json();

  if (!update) {
    return Response.json({ error: "update field required" }, { status: 400 });
  }

  // Update project fields if provided
  const updates: Record<string, unknown> = {};
  if (typeof progress === "number") updates.progress = Math.min(100, Math.max(0, progress));
  if (status) updates.status = status;

  if (Object.keys(updates).length > 0) {
    const { error } = await sb.from("projects").update(updates).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // Save the update as a project note
  await sb.from("project_notes").insert({
    id: crypto.randomUUID(),
    project_id: id,
    content: `[Claude Code Progress Report]\n${update}${typeof progress === "number" ? `\nProgress: ${progress}%` : ""}${status ? `\nStatus: ${status}` : ""}`,
    created_at: new Date().toISOString(),
  });

  // Get updated project
  const { data: project } = await sb.from("projects").select("title, status, progress").eq("id", id).single();

  return Response.json({
    success: true,
    project: project || { id },
    message: `Progress report saved for ${project?.title || id}`,
  });
}
