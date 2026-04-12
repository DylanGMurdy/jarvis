import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

// GET — Load all chat history for a project
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ messages: [] });

  // Conversations tagged with this project use summary = "project:{id}"
  const { data, error } = await sb
    .from("conversations")
    .select("messages")
    .eq("summary", `project:${id}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return Response.json({ messages: [] });
  }

  return Response.json({ messages: data[0].messages || [] });
}

// POST — Send a message in project chat (with full project context)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json({ response: "JARVIS is in demo mode. Add your Anthropic API key to activate." });
  }

  const sb = getSupabase();
  const { messages } = await request.json();

  // Load ALL project context from Supabase
  let projectContext = "";
  if (sb) {
    const [
      { data: project },
      { data: tasks },
      { data: notes },
      { data: prevConvo },
    ] = await Promise.all([
      sb.from("projects").select("*").eq("id", id).single(),
      sb.from("project_tasks").select("*").eq("project_id", id).order("created_at"),
      sb.from("project_notes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      sb.from("conversations").select("messages").eq("summary", `project:${id}`).order("created_at", { ascending: false }).limit(1),
    ]);

    if (project) {
      projectContext = `
CURRENT PROJECT — FULL CONTEXT:
Title: ${project.title}
Category: ${project.category}
Status: ${project.status}
Grade: ${project.grade}
Progress: ${project.progress}%
Revenue Goal: ${project.revenue_goal || "Not set"}
Description: ${project.description || "No description"}`;

      // Pull War Room summary from project record (preferred) or notes
      if (project.war_room_summary && typeof project.war_room_summary === "object") {
        const wr = project.war_room_summary as { confidence_score?: number; top_recommendation?: string; completed_at?: string };
        projectContext += `\n\nWAR ROOM ANALYSIS:`;
        if (wr.confidence_score) projectContext += `\nConfidence: ${wr.confidence_score}/10`;
        if (wr.top_recommendation) projectContext += `\nTop Recommendation: ${wr.top_recommendation}`;
        if (wr.completed_at) projectContext += `\nCompleted: ${new Date(wr.completed_at).toLocaleDateString()}`;
      }
    }

    if (tasks && tasks.length > 0) {
      projectContext += `\n\nTASKS (${tasks.filter((t: { done: boolean }) => t.done).length}/${tasks.length} done):`;
      for (const t of tasks) {
        projectContext += `\n- [${t.done ? "x" : " "}] ${t.title}`;
      }
    }

    // War Room summary fallback — find it in notes if not on project record
    if (notes && notes.length > 0 && !projectContext.includes("WAR ROOM ANALYSIS")) {
      const wrNote = notes.find((n: { content: string }) => n.content.includes("[War Room — JARVIS Summary]") || n.content.includes("[Jarvis War Room Summary]"));
      if (wrNote) {
        projectContext += `\n\nWAR ROOM SUMMARY:\n${(wrNote.content as string).slice(0, 1500)}`;
      }
    }

    // Last 5 notes only (per spec)
    if (notes && notes.length > 0) {
      const recent = notes.slice(0, 5);
      projectContext += `\n\nRECENT NOTES (last ${recent.length}):`;
      for (const n of recent) {
        const date = new Date(n.created_at).toLocaleDateString();
        projectContext += `\n[${date}] ${(n.content as string).slice(0, 200)}`;
      }
    }

    // Include summary of previous conversations (last 10 exchanges)
    if (prevConvo && prevConvo.length > 0) {
      const prev = (prevConvo[0].messages as { role: string; content: string }[]) || [];
      // Only include messages NOT in the current batch (historical context)
      const currentCount = messages.length;
      const historical = prev.slice(0, Math.max(0, prev.length - currentCount));
      if (historical.length > 0) {
        const recentHistory = historical.slice(-20); // Last 10 exchanges
        projectContext += `\n\nPREVIOUS CONVERSATIONS (last ${recentHistory.length} messages):`;
        for (const m of recentHistory) {
          const prefix = m.role === "user" ? "Dylan" : "JARVIS";
          projectContext += `\n${prefix}: ${m.content.slice(0, 150)}`;
        }
      }
    }
  }

  // Load memories too
  let memoriesContext = "";
  if (sb) {
    const { data: memories } = await sb
      .from("memories")
      .select("fact, category")
      .order("created_at", { ascending: false })
      .limit(30);

    if (memories && memories.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const m of memories) {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m.fact);
      }
      memoriesContext = "\n\nLEARNED MEMORIES:";
      for (const [cat, facts] of Object.entries(grouped)) {
        memoriesContext += `\n[${cat.toUpperCase()}]`;
        for (const f of facts) memoriesContext += `\n- ${f}`;
      }
    }
  }

  const systemPrompt = `You are JARVIS, Dylan Murdock's personal AI Chief of Staff. You are an expert product strategist, technical architect, and business advisor.

You have FULL context on this project — every task, note, and previous conversation. Use this knowledge to give informed, specific advice. Reference previous discussions when relevant. Never ask Dylan to repeat information you already have.

Be direct, strategic, and action-oriented. Call him "sir" occasionally.
${projectContext}${memoriesContext}

Stay focused on THIS project. Help Dylan make decisions, overcome blockers, and move it forward. Be specific and actionable.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const assistantResponse = textBlock ? textBlock.text : "No response generated.";

    // Save the full conversation to Supabase
    const allMessages = [...messages, { role: "assistant", content: assistantResponse }];
    if (sb) {
      // Upsert: check if a conversation for this project exists
      const { data: existing } = await sb
        .from("conversations")
        .select("id")
        .eq("summary", `project:${id}`)
        .limit(1);

      if (existing && existing.length > 0) {
        await sb.from("conversations")
          .update({ messages: allMessages, created_at: new Date().toISOString() })
          .eq("id", existing[0].id);
      } else {
        await sb.from("conversations").insert({
          messages: allMessages,
          summary: `project:${id}`,
          created_at: new Date().toISOString(),
        });
      }
    }

    return Response.json({ response: assistantResponse });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ response: `Error: ${msg}` }, { status: 500 });
  }
}
