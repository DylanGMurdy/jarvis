import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "operations_stack" | "sop_framework" | "vendor_strategy" | "scale_plan";

const SYSTEM_PROMPT = `You are the VP of Operations agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan is a real estate agent in Eagle Mountain, Utah building multiple AI and real estate businesses. He runs lean — no office, no employees, maximum automation. He uses Next.js, Supabase, Netlify, Lindy AI, and Claude Code as his core stack.

Your role: Build operational systems that scale without adding headcount. Think in terms of systems and automation, not people and processes. Every recommendation should answer: can this run without Dylan touching it daily? Favor tools with APIs and automation capabilities. Keep costs proportional to revenue.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  operations_stack: (title, desc) => `Recommend the full operations tech stack for "${title}".

Project description: ${desc}

Organize by category:

1. **Project Management** — tool, cost, why (compare 2-3 options)
2. **Communication** — internal (if team grows) and external (customer-facing)
3. **Automation & Workflows** — Zapier vs Make vs Lindy vs custom, when to use each
4. **Documentation** — where to store SOPs, wikis, runbooks
5. **Financial Operations** — invoicing, accounting, tax prep
6. **Analytics & Monitoring** — dashboards, alerting, usage tracking
7. **Security & Compliance** — password management, backup, data handling

For each tool:
- **Name and Cost** — monthly price at current stage
- **Why This One** — specific reason over alternatives
- **Integration Score** — how well it connects to Supabase/Next.js/Lindy (1-5)
- **Scale Score** — will it still work at 10x the current size? (1-5)

End with **Total Monthly Cost** at 10, 50, and 100 customers.`,

  sop_framework: (title, desc) => `Create a standard operating procedures framework for "${title}".

Project description: ${desc}

Provide SOPs for the 8 core processes:

1. **New Customer Onboarding** — step-by-step from payment to first value delivery
2. **Customer Support Handling** — triage, response, escalation, resolution
3. **Billing & Invoicing** — monthly cycle, failed payments, refund policy
4. **Product Deployment** — how updates get shipped safely
5. **Lead Follow-Up** — from inquiry to demo to close
6. **Quality Assurance** — how to verify deliverables before sending to customers
7. **Offboarding** — graceful customer departure (data export, feedback, win-back)
8. **Incident Response** — what happens when something breaks (detection, fix, communication)

For each SOP:
- **Trigger** — what starts this process
- **Steps** — numbered checklist (max 8 steps)
- **Owner** — Dylan, AI agent, or contractor
- **Tools Used** — specific tools for each step
- **Time Estimate** — how long it takes
- **Automation Potential** — what can be automated today vs requires a human`,

  vendor_strategy: (title, desc) => `Identify key vendors and suppliers needed for "${title}".

Project description: ${desc}

Provide:
1. **Critical Vendors** — services the business cannot operate without
2. **Nice-to-Have Vendors** — services that improve quality or save time
3. **Future Vendors** — services needed at scale but not yet

For each vendor:
- **Category** — what need it fills
- **Recommended Vendor** — specific company/product
- **Monthly Cost** — at current stage
- **Alternative** — backup vendor if primary fails or raises prices
- **Contract Tips** — monthly vs annual, negotiation leverage points
- **Risk** — what happens if this vendor disappears or raises prices 3x

Also provide:
- **Vendor Consolidation** — where one tool can replace multiple vendors
- **Build vs Buy Matrix** — for each vendor category, should Dylan build it himself?
- **Total Vendor Spend** — monthly cost breakdown at 10, 50, 100 customers
- **Negotiation Playbook** — 3 specific tactics for getting better pricing`,

  scale_plan: (title, desc) => `Build a scaling plan for "${title}" from 0 to 1000 customers.

Project description: ${desc}

Provide a detailed plan for each stage:

**Stage 1: 0-10 Customers (Validation)**
- Operations model (everything manual is fine)
- What to measure to know it's working
- Go/no-go criteria for Stage 2

**Stage 2: 10-50 Customers (Systematize)**
- What breaks at this scale and how to fix it
- First automations to build
- Team needs (contractors, AI agents)
- Monthly operational cost

**Stage 3: 50-100 Customers (Optimize)**
- Operational bottlenecks and solutions
- Quality assurance at scale
- Support model evolution
- Revenue vs cost trajectory

**Stage 4: 100-500 Customers (Delegate)**
- What Dylan must stop doing personally
- Team structure needed
- Systems that must be in place
- Infrastructure changes

**Stage 5: 500-1000 Customers (Enterprise)**
- Organizational changes
- Platform vs service decisions
- Competitive moat through operations
- Exit readiness checklist

For each stage include: timeline estimate, monthly revenue, monthly cost, Dylan's weekly time commitment.`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: operations_stack, sop_framework, vendor_strategy, or scale_plan" }, { status: 400 });
    }

    if (!projectId || !projectTitle) {
      return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const claude = new Anthropic({ apiKey });
    const prompt = ACTION_PROMPTS[action as Action](projectTitle, projectDescription || "No description provided");

    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const output = msg.content[0].type === "text" ? msg.content[0].text : "";

    const sb = getSupabaseAdmin();
    if (sb) {
      const labels: Record<Action, string> = {
        operations_stack: "Operations Stack",
        sop_framework: "SOP Framework",
        vendor_strategy: "Vendor Strategy",
        scale_plan: "Scale Plan",
      };
      await sb.from("project_notes").insert({
        id: `vp-ops-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[VP Operations — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
