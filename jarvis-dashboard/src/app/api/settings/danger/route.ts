import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action } = await request.json();

  if (action === "clear_notifications") {
    // Delete all approval queue items (used as notifications surface)
    await sb.from("approval_queue").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return Response.json({ ok: true, action });
  }

  if (action === "reset_agents") {
    // Delete all project_notes that came from agents (anything with a source containing "agent" or known agent sources)
    const agentSources = [
      "cmo_agent", "cfo_agent", "cto_agent", "coo_agent", "clo_agent", "chro_agent", "cso_agent",
      "vp_sales_agent", "vp_product_agent", "vp_engineering_agent", "vp_marketing_agent",
      "vp_finance_agent", "vp_operations_agent", "head_of_growth_agent", "head_of_content_agent",
      "head_of_design_agent", "head_cx_agent", "head_of_pr_agent", "sdr_agent", "partnerships_agent",
      "data_analytics_agent", "customer_success_agent", "investor_relations_agent",
      "head_of_recruiting_agent", "jarvis_briefing",
    ];
    await sb.from("project_notes").delete().in("source", agentSources);
    return Response.json({ ok: true, action });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
