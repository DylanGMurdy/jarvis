import { getSupabase } from "@/lib/supabase";
import { createProjectFolder, listFolderFiles, getFolderLink } from "@/lib/googleDrive";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  // Check if project already has a Drive folder
  const { data: project, error: fetchErr } = await sb
    .from("projects")
    .select("id, title, drive_folder_id")
    .eq("id", id)
    .single();

  if (fetchErr || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // If folder already exists, return it
  if (project.drive_folder_id) {
    return Response.json({
      ok: true,
      folderId: project.drive_folder_id,
      folderLink: getFolderLink(project.drive_folder_id),
    });
  }

  // Create new Drive folder
  try {
    const folderId = await createProjectFolder(project.title);

    // Save folder ID to Supabase
    const { error: updateErr } = await sb
      .from("projects")
      .update({ drive_folder_id: folderId })
      .eq("id", id);

    if (updateErr) {
      return Response.json({ error: `Saved folder but failed to update project: ${updateErr.message}` }, { status: 500 });
    }

    return Response.json({
      ok: true,
      folderId,
      folderLink: getFolderLink(folderId),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { data: project, error: fetchErr } = await sb
    .from("projects")
    .select("drive_folder_id")
    .eq("id", id)
    .single();

  if (fetchErr || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.drive_folder_id) {
    return Response.json({ connected: false, files: [] });
  }

  try {
    const files = await listFolderFiles(project.drive_folder_id);
    return Response.json({
      connected: true,
      folderId: project.drive_folder_id,
      folderLink: getFolderLink(project.drive_folder_id),
      files,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({
      connected: true,
      folderId: project.drive_folder_id,
      folderLink: getFolderLink(project.drive_folder_id),
      files: [],
      warning: msg,
    });
  }
}
