import { getSupabase } from "@/lib/supabase";

interface SaveBody {
  results: Record<string, string>; // agentName -> result text
  summary: {
    consensus: string[];
    conflicts: string[];
    recommendations: string[];
    confidence_score: number;
    verdict: string;
  };
  projectTitle?: string;
}

function agentNameToSourceKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function buildSummaryText(s: SaveBody["summary"]): string {
  const consensus = s.consensus?.length ? s.consensus.map((b) => `- ${b}`).join("\n") : "(none)";
  const conflicts = s.conflicts?.length ? s.conflicts.map((b) => `- ${b}`).join("\n") : "(none)";
  const recs = s.recommendations?.length ? s.recommendations.map((b, i) => `${i + 1}. ${b}`).join("\n") : "(none)";
  return `Verdict: ${s.verdict || "(no verdict)"}\nConfidence: ${s.confidence_score || 0}/10\n\n## What the team agreed on\n${consensus}\n\n## Key conflicts flagged\n${conflicts}\n\n## Recommended next steps\n${recs}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  try {
    const body = (await request.json()) as SaveBody;
    if (!body.results) return Response.json({ ok: false, error: "results is required" }, { status: 400 });

    const summaryText = buildSummaryText(body.summary);

    // Insert one note per agent
    const noteRows = Object.entries(body.results).map(([agentName, result]) => ({
      project_id: projectId,
      content: `[War Room — ${agentName}]\n\n${result}`,
      source: `war_room_${agentNameToSourceKey(agentName)}`,
    }));
    if (noteRows.length > 0) {
      await sb.from("project_notes").insert(noteRows);
    }

    // Insert summary note
    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[War Room — JARVIS Summary]\n\n${summaryText}`,
      source: "war_room_summary",
    });

    // Insert session record
    await sb.from("war_room_sessions").insert({
      project_id: projectId,
      confidence_score: body.summary?.confidence_score || 0,
      agents_run: noteRows.length,
      summary_text: summaryText,
      status: "complete",
    });

    // Notification
    try {
      await sb.from("notifications").insert({
        title: "War Room Complete",
        body: `${body.projectTitle || "Project"} — ${noteRows.length} agents analyzed. Confidence: ${body.summary?.confidence_score || 0}/10. View results →`,
        type: "success",
        link: `/ideas/${projectId}`,
        read: false,
      });
    } catch { /* notification optional */ }

    return Response.json({ ok: true, agentsSaved: noteRows.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
