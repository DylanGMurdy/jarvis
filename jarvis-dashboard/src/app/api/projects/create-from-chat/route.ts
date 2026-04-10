import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { conversation, projectId } = await request.json();
  if (!conversation || conversation.length === 0) {
    return Response.json({ error: "No conversation provided" }, { status: 400 });
  }

  const conversationText = conversation
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
    .join("\n\n");

  try {
    const client = new Anthropic({ apiKey });

    if (projectId) {
      // ── ADD TO EXISTING PROJECT ──
      const { data: project } = await sb.from("projects").select("title").eq("id", projectId).single();
      if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `Extract actionable items from this conversation to add to the project "${project.title}". Return ONLY valid JSON with no markdown fences:\n{"tasks": ["task 1", "task 2"], "notes": "summary of key insights and decisions from this conversation", "memories": [{"fact": "...", "category": "business|personal|ideas|goals"}]}`,
        messages: [{ role: "user", content: conversationText }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") return Response.json({ error: "No response" }, { status: 500 });

      const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
      const extracted = JSON.parse(cleaned);

      let tasksCreated = 0;
      let notesCreated = 0;

      // Add tasks
      if (extracted.tasks?.length > 0) {
        const taskRows = extracted.tasks.map((t: string) => ({
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          project_id: projectId,
          title: t,
          done: false,
          created_at: new Date().toISOString(),
        }));
        const { error } = await sb.from("project_tasks").insert(taskRows);
        if (!error) tasksCreated = taskRows.length;
      }

      // Add note
      if (extracted.notes) {
        const { error } = await sb.from("project_notes").insert({
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          project_id: projectId,
          content: extracted.notes,
          created_at: new Date().toISOString(),
        });
        if (!error) notesCreated = 1;
      }

      // Save conversation linked to project
      await sb.from("conversations").insert({
        messages: conversation,
        summary: `project:${projectId}`,
        title: `Chat routed to ${project.title}`,
        conversation_type: "project",
        project_id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Save memories
      if (extracted.memories?.length > 0) {
        await sb.from("memories").insert(
          extracted.memories.map((m: { fact: string; category: string }) => ({
            fact: m.fact,
            category: m.category || "business",
            source: "chat_extraction",
            confidence: 0.8,
          }))
        );
      }

      return Response.json({
        success: true,
        projectTitle: project.title,
        projectId,
        tasksCreated,
        notesCreated,
      });
    } else {
      // ── CREATE NEW PROJECT ──
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `Analyze this conversation and create a project from it. Return ONLY valid JSON with no markdown fences:\n{"title": "Short project title", "description": "2-3 sentence description", "category": "AI Business|Real Estate|Side Hustles|Personal", "grade": "A|B|C", "revenue_goal": "$X/mo or N/A", "status": "Idea|Planning|Building", "tasks": ["task 1", "task 2", "task 3"], "notes": ["key insight 1", "key decision 2"], "next_actions": "what to do next"}`,
        messages: [{ role: "user", content: conversationText }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") return Response.json({ error: "No response" }, { status: 500 });

      const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
      const extracted = JSON.parse(cleaned);

      const projectIdNew = `proj-${Date.now()}`;

      // Create project
      const { error: projErr } = await sb.from("projects").insert({
        id: projectIdNew,
        title: extracted.title || "Untitled Project",
        description: extracted.description || "",
        category: extracted.category || "AI Business",
        grade: extracted.grade || "B",
        revenue_goal: extracted.revenue_goal || "",
        status: extracted.status || "Idea",
        progress: 0,
        created_at: new Date().toISOString(),
      });

      if (projErr) return Response.json({ error: projErr.message }, { status: 500 });

      let tasksCreated = 0;
      let notesCreated = 0;

      // Create tasks
      if (extracted.tasks?.length > 0) {
        const taskRows = extracted.tasks.map((t: string) => ({
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          project_id: projectIdNew,
          title: t,
          done: false,
          created_at: new Date().toISOString(),
        }));
        await sb.from("project_tasks").insert(taskRows);
        tasksCreated = taskRows.length;
      }

      // Create notes
      if (extracted.notes?.length > 0) {
        const noteRows = extracted.notes.map((n: string) => ({
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          project_id: projectIdNew,
          content: n,
          created_at: new Date().toISOString(),
        }));
        await sb.from("project_notes").insert(noteRows);
        notesCreated = noteRows.length;
      }

      // Add next_actions as a note
      if (extracted.next_actions) {
        await sb.from("project_notes").insert({
          id: `note-${Date.now()}-next`,
          project_id: projectIdNew,
          content: `Next Actions:\n${extracted.next_actions}`,
          created_at: new Date().toISOString(),
        });
        notesCreated++;
      }

      // Link conversation to project
      await sb.from("conversations").insert({
        messages: conversation,
        summary: `project:${projectIdNew}`,
        title: `Origin chat for ${extracted.title}`,
        conversation_type: "project",
        project_id: projectIdNew,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        project: { id: projectIdNew, title: extracted.title },
        tasksCreated,
        notesCreated,
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
