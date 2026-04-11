import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

// Wave 1: Foundation agents that inform everyone else
const WAVE_1 = [
  { key: "cfo", route: "/api/agents/cfo", actions: ["revenue_model", "unit_economics", "funding_needs", "financial_risks"], label: "CFO" },
  { key: "cto", route: "/api/agents/cto", actions: ["tech_stack", "build_roadmap", "technical_risks", "mvp_scope"], label: "CTO" },
  { key: "clo", route: "/api/agents/clo", actions: ["legal_risks", "entity_structure", "contracts_needed", "compliance_checklist"], label: "CLO" },
  { key: "coo", route: "/api/agents/coo", actions: ["operations_plan", "hiring_plan", "process_map", "kpis"], label: "COO" },
];

// Wave 2: All other agents briefed with Wave 1 context
const WAVE_2 = [
  { key: "cmo", route: "/api/agents/cmo", action: "market_analysis", label: "CMO" },
  { key: "cso", route: "/api/agents/cso", action: "sales_strategy", label: "CSO" },
  { key: "chro", route: "/api/agents/chro", action: "org_structure", label: "CHRO" },
  { key: "vp_product", route: "/api/agents/vp_product", action: "feature_roadmap", label: "VP Product" },
  { key: "vp_engineering", route: "/api/agents/vp_engineering", action: "architecture_plan", label: "VP Engineering" },
  { key: "vp_sales", route: "/api/agents/vp_sales", action: "pipeline_structure", label: "VP Sales" },
  { key: "vp_operations", route: "/api/agents/vp_operations", action: "scale_plan", label: "VP Operations" },
  { key: "head_cx", route: "/api/agents/head_cx", action: "cx_strategy", label: "Head of CX" },
  { key: "head_of_recruiting", route: "/api/agents/head_of_recruiting", action: "hiring_process", label: "Head of Recruiting" },
  { key: "investor_relations", route: "/api/agents/investor_relations", action: "investor_update", label: "Investor Relations" },
  { key: "head_of_growth", route: "/api/agents/head_of_growth", action: "growth_loops", label: "Head of Growth" },
  { key: "head_of_content", route: "/api/agents/head_of_content", action: "content_calendar", label: "Head of Content" },
  { key: "head_of_design", route: "/api/agents/head_of_design", action: "design_system", label: "Head of Design" },
  { key: "head_of_pr", route: "/api/agents/head_of_pr", action: "pr_strategy", label: "Head of PR" },
  { key: "customer_success", route: "/api/agents/customer_success", action: "onboarding_flow", label: "Customer Success" },
  { key: "data_analytics", route: "/api/agents/data_analytics", action: "metrics_framework", label: "Data Analytics" },
  { key: "orchestrator", route: "/api/agents/orchestrator", action: "daily_briefing", label: "Orchestrator" },
];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabaseAdmin();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { updatedContext } = await request.json();

  // Fetch project data
  const [projectRes, tasksRes, notesRes, chatRes] = await Promise.all([
    sb.from("projects").select("*").eq("id", id).single(),
    sb.from("project_tasks").select("title, done").eq("project_id", id),
    sb.from("project_notes").select("content, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("conversations").select("messages").eq("conversation_type", "project").limit(5),
  ]);

  const project = projectRes.data;
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const tasks = tasksRes.data || [];
  const notes = notesRes.data || [];
  const chatHistory = chatRes.data?.flatMap((c: { messages: { role: string; content: string }[] }) => c.messages || []).slice(-20) || [];

  const baseContext = `PROJECT: ${project.title}
Category: ${project.category} | Status: ${project.status} | Grade: ${project.grade}
Revenue Goal: ${project.revenue_goal} | Progress: ${project.progress}%

DESCRIPTION:
${project.description}

TASKS:
${tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "None"}

RECENT NOTES:
${notes.slice(0, 10).map((n: { content: string }) => n.content.slice(0, 300)).join("\n---\n") || "None"}

CHAT HISTORY (recent):
${chatHistory.slice(-10).map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 200)}`).join("\n") || "None"}

${updatedContext ? `UPDATED CONTEXT:\n${updatedContext}` : ""}`;

  const claude = new Anthropic({ apiKey });
  const results: Record<string, { agent: string; output: string }> = {};

  // Wave 1: Run foundation agents in parallel
  const wave1Promises = WAVE_1.map(async (agent) => {
    try {
      const msg = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        system: `You are the ${agent.label} agent. Provide a concise executive summary covering your domain for this project. Cover the most critical points from your expertise area. Format with clear sections. Keep under 400 words.`,
        messages: [{ role: "user", content: `Analyze this project:\n\n${baseContext}` }],
      });
      const output = msg.content[0].type === "text" ? msg.content[0].text : "";
      results[agent.key] = { agent: agent.label, output };
    } catch (err) {
      results[agent.key] = { agent: agent.label, output: `Error: ${err instanceof Error ? err.message : "Failed"}` };
    }
  });

  await Promise.all(wave1Promises);

  // Build Wave 1 briefing for Wave 2
  const wave1Briefing = Object.entries(results)
    .map(([, v]) => `[${v.agent}]\n${v.output.slice(0, 500)}`)
    .join("\n\n");

  // Wave 2: Run all other agents in parallel with Wave 1 context
  const wave2Promises = WAVE_2.map(async (agent) => {
    try {
      const msg = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        system: `You are the ${agent.label} agent. The C-suite has already analyzed this project. Review their findings and provide your domain-specific analysis. Format with clear sections. Keep under 400 words.`,
        messages: [{ role: "user", content: `Project context:\n\n${baseContext}\n\nC-SUITE BRIEFING:\n${wave1Briefing}` }],
      });
      const output = msg.content[0].type === "text" ? msg.content[0].text : "";
      results[agent.key] = { agent: agent.label, output };
    } catch (err) {
      results[agent.key] = { agent: agent.label, output: `Error: ${err instanceof Error ? err.message : "Failed"}` };
    }
  });

  await Promise.all(wave2Promises);

  // Generate Jarvis Summary
  const allReports = Object.entries(results)
    .map(([, v]) => `[${v.agent}]: ${v.output.slice(0, 300)}`)
    .join("\n\n");

  let jarvisSummary = "";
  try {
    const summaryMsg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: "You are JARVIS, the master AI orchestrator. Synthesize all agent reports into one executive briefing for Dylan. Highlight the 3 most critical findings, top conflicts between agents, and your recommended next 3 actions. Be direct and actionable.",
      messages: [{ role: "user", content: `Synthesize these ${Object.keys(results).length} agent reports for "${project.title}":\n\n${allReports}` }],
    });
    jarvisSummary = summaryMsg.content[0].type === "text" ? summaryMsg.content[0].text : "";
  } catch {
    jarvisSummary = "Summary generation failed.";
  }

  // Save all results to project_notes (delete old war_room_refresh entries first)
  const { data: oldNotes } = await sb
    .from("project_notes")
    .select("id")
    .eq("project_id", id)
    .like("content", "[War Room Refresh%");

  if (oldNotes?.length) {
    await sb.from("project_notes").delete().in("id", oldNotes.map((n: { id: string }) => n.id));
  }

  // Save new results
  const noteRows = [
    ...Object.entries(results).map(([key, v]) => ({
      id: `wr-refresh-${key}-${Date.now()}`,
      project_id: id,
      content: `[War Room Refresh — ${v.agent}]\n${v.output}`,
      created_at: new Date().toISOString(),
    })),
    {
      id: `wr-refresh-summary-${Date.now()}`,
      project_id: id,
      content: `[War Room Refresh — JARVIS Summary]\n${jarvisSummary}`,
      created_at: new Date().toISOString(),
    },
  ];

  await sb.from("project_notes").insert(noteRows);

  return Response.json({
    ok: true,
    agentCount: Object.keys(results).length,
    results,
    jarvisSummary,
    savedNotes: noteRows.length,
  });
}
