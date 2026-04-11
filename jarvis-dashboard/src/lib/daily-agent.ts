import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

interface AgentResult {
  ok: boolean;
  projectsProcessed: number;
  tasksGenerated: number;
  errors: string[];
}

function getClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase not configured");
  if (!anthropicKey) throw new Error("Anthropic API key not configured");

  return {
    sb: createClient(supabaseUrl, supabaseKey),
    claude: new Anthropic({ apiKey: anthropicKey }),
  };
}

export async function runDailyAgent(): Promise<AgentResult> {
  const { sb, claude } = getClients();
  const errors: string[] = [];
  let tasksGenerated = 0;

  // Fetch active projects
  const { data: projects, error: fetchErr } = await sb
    .from("projects")
    .select("*")
    .in("status", ["Building", "Planning", "Idea"]);

  if (fetchErr) throw new Error(`Failed to fetch projects: ${fetchErr.message}`);
  if (!projects || projects.length === 0) {
    return { ok: true, projectsProcessed: 0, tasksGenerated: 0, errors: [] };
  }

  for (const project of projects) {
    try {
      // Get recent notes for context
      const { data: recentNotes } = await sb
        .from("project_notes")
        .select("content, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Get existing tasks
      const { data: tasks } = await sb
        .from("project_tasks")
        .select("title, done")
        .eq("project_id", project.id)
        .limit(20);

      const notesContext = (recentNotes || [])
        .map((n: { content: string; created_at: string }) => `- ${n.content.slice(0, 200)}`)
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
            content: `Project: ${project.title}
Category: ${project.category}
Status: ${project.status}
Progress: ${project.progress}%
Description: ${project.description || "No description"}

Recent notes:
${notesContext || "None"}

Current tasks:
${tasksContext || "None"}

Generate 2-3 actionable tasks for today.`,
          },
        ],
      });

      const content =
        msg.content[0].type === "text" ? msg.content[0].text : "";

      // Save as a project note
      await sb.from("project_notes").insert({
        id: `daily-${project.id}-${Date.now()}`,
        project_id: project.id,
        content: `[Daily Agent] Tasks for ${new Date().toLocaleDateString()}:\n${content}`,
        created_at: new Date().toISOString(),
      });

      // Count tasks generated (lines starting with a number)
      const taskCount = (content.match(/^\d+\./gm) || []).length;
      tasksGenerated += taskCount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${project.title}: ${msg}`);
    }
  }

  // POST summary to lindy/update
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "http://localhost:3000";
    const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
    await fetch(`${url}/api/lindy/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Daily Agent processed ${projects.length} projects, generated ${tasksGenerated} tasks${errors.length ? ` (${errors.length} errors)` : ""}`,
        tasks_completed: tasksGenerated,
        flags: errors.length > 0 ? ["daily-agent-errors"] : [],
      }),
    });
  } catch {
    // non-critical
  }

  return {
    ok: true,
    projectsProcessed: projects.length,
    tasksGenerated,
    errors,
  };
}
