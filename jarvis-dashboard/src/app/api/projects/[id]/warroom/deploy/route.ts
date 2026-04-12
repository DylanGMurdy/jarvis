import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

// All agent endpoints with their actions
const WAVE_1_AGENTS = [
  { endpoint: "/api/agents/cmo", actions: ["market_analysis", "content_strategy", "growth_channels", "brand_voice"] },
  { endpoint: "/api/agents/cto", actions: ["tech_stack", "build_roadmap", "technical_risks", "mvp_scope"] },
  { endpoint: "/api/agents/cfo", actions: ["revenue_model", "unit_economics", "funding_needs", "financial_risks"] },
  { endpoint: "/api/agents/cso", actions: ["sales_strategy", "prospect_list", "sales_script", "pricing_strategy"] },
  { endpoint: "/api/agents/coo", actions: ["operations_plan", "process_design", "resource_allocation", "kpi_framework"] },
];

const WAVE_2_AGENTS = [
  { endpoint: "/api/agents/vp_sales", actions: ["pipeline_structure", "objection_handling", "demo_script", "close_playbook"] },
  { endpoint: "/api/agents/vp_finance", actions: ["financial_model", "cash_flow", "pricing_analysis", "investor_metrics"] },
  { endpoint: "/api/agents/sdr", actions: ["cold_outreach", "lead_qualification", "follow_up_sequences", "outreach_personalization"] },
  { endpoint: "/api/agents/partnerships", actions: ["partnership_targets", "partnership_pitch", "affiliate_program", "integration_opportunities"] },
  { endpoint: "/api/agents/data_analytics", actions: ["metrics_framework", "dashboard_design", "data_infrastructure", "ab_testing_framework"] },
  { endpoint: "/api/agents/clo", actions: ["legal_risks", "entity_structure", "contracts_needed", "compliance_checklist"] },
  { endpoint: "/api/agents/chro", actions: ["org_structure", "hiring_plan", "culture_framework", "compensation_strategy"] },
];

interface AgentResult {
  agent: string;
  action: string;
  result: string;
  ok: boolean;
}

async function runAgentAction(
  baseUrl: string,
  endpoint: string,
  action: string,
  projectId: string,
  projectTitle: string,
  projectDescription: string
): Promise<AgentResult> {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, projectId, projectTitle, projectDescription }),
    });
    const data = await res.json();
    return {
      agent: endpoint.split("/").pop() || endpoint,
      action,
      result: data.ok ? data.result : data.error || "Failed",
      ok: !!data.ok,
    };
  } catch {
    return { agent: endpoint.split("/").pop() || endpoint, action, result: "Connection error", ok: false };
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  // Get project details
  const { data: project } = await sb.from("projects").select("title, description").eq("id", id).single();
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const baseUrl = request.url.replace(/\/api\/projects\/.*/, "");

  // Wave 1: C-suite runs first (one action each for speed)
  const wave1Promises = WAVE_1_AGENTS.map((agent) =>
    runAgentAction(baseUrl, agent.endpoint, agent.actions[0], id, project.title, project.description)
  );
  const wave1Results = await Promise.all(wave1Promises);

  // Wave 2: VPs and specialists
  const wave2Promises = WAVE_2_AGENTS.map((agent) =>
    runAgentAction(baseUrl, agent.endpoint, agent.actions[0], id, project.title, project.description)
  );
  const wave2Results = await Promise.all(wave2Promises);

  const allResults = [...wave1Results, ...wave2Results];

  // Build context from all agent reports
  const agentReportsContext = allResults
    .filter((r) => r.ok)
    .map((r) => `=== ${r.agent.toUpperCase()} — ${r.action} ===\n${r.result}`)
    .join("\n\n");

  // Jarvis Summary synthesis
  let summary = null;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are Jarvis, Dylan's AI chief of staff. You have just received analysis reports from your entire executive team on a business idea. Your job is to synthesize everything into a clear executive summary for Dylan.

Structure your response as JSON with these exact fields:
- consensus: array of 3 things all agents agreed on
- conflicts: array of key disagreements between agents (e.g. CFO says budget $50K, CTO says needs $200K)
- recommendations: top 5 prioritized next actions
- verdict: one paragraph overall assessment - is this a strong idea worth building?
- confidence_score: number 1-10 on how strong this idea is based on all agent input

Return ONLY valid JSON, no markdown fences.`,
      messages: [{
        role: "user",
        content: `Here are all the agent reports for the project "${project.title}":\n\n${agentReportsContext}\n\nSynthesize these into your executive summary.`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : null;

    if (rawText) {
      try {
        summary = JSON.parse(rawText);
      } catch {
        // If JSON parsing fails, wrap it
        summary = { verdict: rawText, consensus: [], conflicts: [], recommendations: [], confidence_score: 0 };
      }
    }

    // Save summary as a note
    await sb.from("project_notes").insert({
      project_id: id,
      content: `[Jarvis War Room Summary]\n\nVerdict: ${summary?.verdict || "N/A"}\nConfidence: ${summary?.confidence_score || "N/A"}/10\n\nConsensus:\n${(summary?.consensus || []).map((c: string) => `• ${c}`).join("\n")}\n\nConflicts:\n${(summary?.conflicts || []).map((c: string) => `• ${c}`).join("\n")}\n\nRecommendations:\n${(summary?.recommendations || []).map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}`,
    });

    // Save war_room_summary to the project record
    const topRec = (summary?.recommendations || [])[0] || summary?.verdict?.slice(0, 200) || "Review War Room results";
    await sb.from("projects").update({
      war_room_completed_at: new Date().toISOString(),
      war_room_summary: {
        completed_at: new Date().toISOString(),
        confidence_score: summary?.confidence_score || 0,
        agents_ran: allResults.filter((r) => r.ok).length,
        top_recommendation: typeof topRec === "string" ? topRec : String(topRec),
      },
    }).eq("id", id);
  } catch {
    // Summary generation failed but agent results are still valid
  }

  return Response.json({
    ok: true,
    wave1: wave1Results,
    wave2: wave2Results,
    summary,
    agentCount: allResults.filter((r) => r.ok).length,
    totalAgents: allResults.length,
  });
}
