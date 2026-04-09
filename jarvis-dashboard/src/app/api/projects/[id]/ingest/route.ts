import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

// POST /api/projects/[id]/ingest
// Accepts: { text: string }
// Extracts relevant info from pasted text and saves as notes/tasks/memories
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sb = getSupabase();

  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { text } = await request.json();
  if (!text || text.trim().length < 10) {
    return Response.json({ error: "Text too short to extract from" }, { status: 400 });
  }

  // Get project context
  const { data: project } = await sb.from("projects").select("title, description").eq("id", id).single();
  const projectTitle = project?.title || "Unknown project";

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You extract actionable information from conversations/text that is relevant to a specific project. Return ONLY valid JSON with this structure:
{
  "summary": "1-2 sentence summary of what was discussed",
  "notes": ["key insight or decision 1", "key insight 2"],
  "tasks": ["actionable task 1", "actionable task 2"],
  "memories": [{"fact": "...", "category": "business|ideas|goals|preferences"}]
}
Only include items genuinely relevant to the project "${projectTitle}". Skip greetings, off-topic chat. Return empty arrays if nothing relevant. No markdown fences.`,
      messages: [{
        role: "user",
        content: `Extract information relevant to the project "${projectTitle}" (${project?.description?.slice(0, 100) || ""}) from this text:\n\n${text.slice(0, 5000)}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No extraction" }, { status: 500 });
    }

    const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
    const extracted = JSON.parse(cleaned);

    let savedNotes = 0;
    let savedTasks = 0;
    let savedMemories = 0;

    // Save notes
    if (extracted.notes && extracted.notes.length > 0) {
      const noteContent = `[Synced from external conversation]\n\n${extracted.summary || ""}\n\n${extracted.notes.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}`;
      await sb.from("project_notes").insert({
        id: crypto.randomUUID(),
        project_id: id,
        content: noteContent,
        created_at: new Date().toISOString(),
      });
      savedNotes = extracted.notes.length;
    }

    // Save tasks
    if (extracted.tasks && extracted.tasks.length > 0) {
      const taskInserts = extracted.tasks.map((t: string) => ({
        id: crypto.randomUUID(),
        project_id: id,
        title: t,
        done: false,
        created_at: new Date().toISOString(),
      }));
      await sb.from("project_tasks").insert(taskInserts);
      savedTasks = extracted.tasks.length;
    }

    // Save memories
    if (extracted.memories && extracted.memories.length > 0) {
      const memInserts = extracted.memories
        .filter((m: { fact: string }) => m.fact)
        .map((m: { fact: string; category: string }) => ({
          fact: m.fact,
          category: m.category || "business",
          source: "external_sync",
          confidence: 0.8,
        }));
      if (memInserts.length > 0) {
        await sb.from("memories").insert(memInserts);
        savedMemories = memInserts.length;
      }
    }

    return Response.json({
      success: true,
      summary: extracted.summary || "Processed",
      saved: { notes: savedNotes, tasks: savedTasks, memories: savedMemories },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
