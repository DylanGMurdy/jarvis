import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export default async (req: Request) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: "Missing environment variables" }), { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const claude = new Anthropic({ apiKey: anthropicKey });

  const { data: projects, error: fetchErr } = await sb
    .from("projects")
    .select("*")
    .in("status", ["Building", "Planning", "Idea"]);

  if (fetchErr || !projects) {
    return new Response(JSON.stringify({ error: fetchErr?.message || "No projects" }), { status: 500 });
  }

  let tasksGenerated = 0;
  const errors: string[] = [];

  for (const project of projects) {
    try {
      const { data: recentNotes } = await sb
        .from("project_notes")
        .select("content, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: tasks } = await sb
        .from("project_tasks")
        .select("title, done")
        .eq("project_id", project.id)
        .limit(20);

      const notesContext = (recentNotes || [])
        .map((n: { content: string }) => `- ${n.content.slice(0, 200)}`)
        .join("\n");

      const tasksContext = (tasks || [])
        .map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`)
        .join("\n");

      const msg = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `You are a Daily Progress Agent for JARVIS, a business management system. Your job is to review a project's current state and generate 2-3 specific, actionable tasks for today. Be concise and practical. Output ONLY the tasks as a numbered list (1. 2. 3.), nothing else.`,
        messages: [
          {
            role: "user",
            content: `Project: ${project.title}\nCategory: ${project.category}\nStatus: ${project.status}\nProgress: ${project.progress}%\nDescription: ${project.description || "No description"}\n\nRecent notes:\n${notesContext || "None"}\n\nCurrent tasks:\n${tasksContext || "None"}\n\nGenerate 2-3 actionable tasks for today.`,
          },
        ],
      });

      const content = msg.content[0].type === "text" ? msg.content[0].text : "";

      await sb.from("project_notes").insert({
        id: `daily-${project.id}-${Date.now()}`,
        project_id: project.id,
        content: `[Daily Agent] Tasks for ${new Date().toLocaleDateString()}:\n${content}`,
        created_at: new Date().toISOString(),
      });

      tasksGenerated += (content.match(/^\d+\./gm) || []).length;
    } catch (err) {
      errors.push(`${project.title}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Notify lindy
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "http://localhost:3000";
    const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
    await fetch(`${url}/api/lindy/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Daily Agent processed ${projects.length} projects, generated ${tasksGenerated} tasks`,
        tasks_completed: tasksGenerated,
        flags: errors.length > 0 ? ["daily-agent-errors"] : [],
      }),
    });
  } catch {
    // non-critical
  }

  return new Response(
    JSON.stringify({ ok: true, projectsProcessed: projects.length, tasksGenerated, errors }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const config: Config = { schedule: "0 8 * * *" };
