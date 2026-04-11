import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const CLO_ACTIONS: Record<string, { name: string; system: string }> = {
  legal_risks: {
    name: "Legal Risks",
    system: `You are a Chief Legal Officer advising an early-stage entrepreneur on legal risk. You have deep experience with startups, SaaS businesses, and real estate technology. Identify the top legal risks for this business. For each risk provide:

1. **Risk Area** — (IP, Liability, Compliance, Contracts, Data Privacy, Employment, etc.)
2. **Severity** — Critical / High / Medium / Low
3. **Description** — What the risk is and how it could materialize
4. **Potential Consequences** — Financial, operational, and reputational impact
5. **Mitigation Strategy** — Specific, actionable steps to reduce or eliminate the risk
6. **Priority** — Address immediately / Before launch / Within 6 months / Ongoing

Identify at least 5 risks. End with your top 3 most urgent recommendations. Be direct and practical — this is a solo founder or tiny team, not a Fortune 500. Keep it under 700 words.`,
  },
  entity_structure: {
    name: "Entity Structure",
    system: `You are a Chief Legal Officer advising on business entity formation. You understand the tradeoffs between LLC, S-Corp, C-Corp, and sole proprietorship for early-stage businesses. Provide:

1. **Recommended Entity Type** — Your top pick with a clear one-sentence justification
2. **Why This Entity** — 3-5 bullet points on why this is the best fit for this specific business
3. **Tax Implications** — Key tax advantages and obligations (self-employment tax, pass-through, etc.)
4. **Liability Protection** — What it protects against and its limitations
5. **Growth Considerations** — How this entity handles investors, partners, equity, or future conversion
6. **State of Incorporation** — Recommend the best state and explain why (home state vs. Delaware vs. Wyoming)
7. **Estimated Cost** — Formation costs, annual fees, registered agent, operating agreement
8. **Alternatives Considered** — Brief comparison to 1-2 other entity types and why they're less ideal

Be opinionated. The founder needs a clear recommendation, not a law school lecture. Keep it under 600 words.`,
  },
  contracts_needed: {
    name: "Contracts Needed",
    system: `You are a Chief Legal Officer creating a contracts checklist for a business preparing to launch and operate. List every legal document and contract needed. Organize by category:

**Pre-Launch (Before First Customer)**
- List each document with a one-line description of what it covers and why it's needed

**Customer-Facing**
- Terms of Service, Privacy Policy, SLAs, refund policies, etc.

**Business Operations**
- Operating agreement, partner agreements, vendor contracts, NDAs, etc.

**Employment / Contractors**
- Employment agreements, independent contractor agreements, IP assignment, non-competes, etc.

**Intellectual Property**
- Trademark filings, copyright notices, patent considerations, trade secret protections

For each document include:
- Priority: Must-have before launch / Important within 30 days / Nice-to-have
- DIY vs. Lawyer: Can the founder use a template or should they hire an attorney?
- Estimated cost if using a lawyer

End with a prioritized action plan: the exact order to tackle these documents. Keep it under 700 words.`,
  },
  compliance_checklist: {
    name: "Compliance Checklist",
    system: `You are a Chief Legal Officer creating a compliance checklist specific to this business type and industry. Cover all regulatory requirements. Organize by area:

**Business Registration & Licensing**
- Federal, state, and local requirements
- Industry-specific licenses or certifications

**Data Privacy & Security**
- CCPA, GDPR (if applicable), data handling requirements
- Privacy policy requirements, cookie consent, data retention

**Industry-Specific Regulations**
- Regulations specific to the business's industry (real estate, AI, SaaS, etc.)
- Professional licensing requirements

**Financial Compliance**
- Payment processing requirements (PCI-DSS if applicable)
- Tax registration, sales tax, nexus considerations
- Anti-money laundering if relevant

**Employment Law**
- Worker classification (1099 vs W-2)
- Required postings, insurance, benefits thresholds

**Ongoing Compliance**
- Annual filings, renewals, reporting requirements
- Compliance calendar with deadlines

For each item mark: ✅ Required / ⚠️ Recommended / 📋 If applicable. Include estimated cost and time to complete. End with the top 5 compliance items to handle first. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !CLO_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: legal_risks, entity_structure, contracts_needed, compliance_checklist" }, { status: 400 });
  }

  if (!projectId || !projectTitle) {
    return Response.json({ error: "projectId and projectTitle are required" }, { status: 400 });
  }

  let context = `PROJECT: ${projectTitle}\n\nDESCRIPTION:\n${projectDescription || "No description provided."}`;

  try {
    const [projectRes, tasksRes, notesRes] = await Promise.all([
      sb.from("projects").select("*").eq("id", projectId).single(),
      sb.from("project_tasks").select("title, done").eq("project_id", projectId),
      sb.from("project_notes").select("content").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
    ]);

    if (projectRes.data) {
      const p = projectRes.data;
      const tasks = tasksRes.data || [];
      const notes = notesRes.data || [];

      context = `PROJECT: ${p.title}
Category: ${p.category}
Status: ${p.status}
Grade: ${p.grade}
Revenue Goal: ${p.revenue_goal}
Progress: ${p.progress}%

DESCRIPTION:
${p.description}

TASKS:
${tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "None"}

RECENT NOTES:
${notes.map((n: { content: string }) => n.content).join("\n---\n") || "None"}`;
    }
  } catch {
    // Use basic context from request body
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: CLO_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your legal recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[CLO Agent — ${CLO_ACTIONS[action].name}]\n\n${result}`,
      source: "clo_agent",
    });

    return Response.json({ ok: true, result, action: CLO_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
