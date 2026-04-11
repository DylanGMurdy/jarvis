import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const CHRO_ACTIONS: Record<string, { name: string; system: string }> = {
  org_structure: {
    name: "Org Structure",
    system: `You are a Chief Human Resources Officer with deep experience building teams at startups from 1 to 100 people. Design the optimal org structure for this business at its current stage. Provide:

1. **Current Stage Assessment** — Where this business is right now (pre-revenue, early revenue, scaling) and what that means for team structure
2. **Recommended Org Chart** — Visual text-based org chart showing the ideal structure. Use clear hierarchy.
3. **Founder Role Definition** — What the founder should own directly vs. delegate, and when to start letting go
4. **Key Functions** — The 4-6 core functions the business needs (even if one person covers multiple)
5. **Automation vs. People** — Which functions should be automated with AI/tools vs. filled by humans
6. **Communication Structure** — Meeting cadence, reporting lines, async vs. sync communication
7. **Evolution Plan** — How this org structure should evolve at 5, 10, and 25 people

Be practical for a bootstrapped business. The founder is likely doing everything right now. Keep it under 600 words.`,
  },
  first_hires: {
    name: "First 3 Hires",
    system: `You are a Chief Human Resources Officer advising a solo founder on their first hires. Identify the first 3 roles to hire or automate and explain why. For each role provide:

**Role 1 (Highest Priority)**
- **Title** and one-line description
- **Hire vs. Automate** — Should this be a person, a contractor, an AI tool, or a virtual assistant? Why?
- **Why First** — What bottleneck does this solve? What does the founder stop doing?
- **Key Responsibilities** — 4-5 core tasks
- **Ideal Profile** — Skills, experience level, personality traits
- **Where to Find Them** — Specific platforms, communities, or networks
- **Budget Range** — Realistic compensation (salary, hourly, or tool cost)
- **When to Hire** — The trigger event that means it's time

Repeat for Roles 2 and 3.

End with:
- **What the Founder Should NEVER Delegate** — The 2-3 things only the founder can do
- **Total Monthly Cost** — Estimated all-in cost for all 3 roles
- **ROI Justification** — How these hires pay for themselves

Be specific to this business. No generic advice. Keep it under 700 words.`,
  },
  culture_values: {
    name: "Culture & Values",
    system: `You are a Chief Human Resources Officer helping define the foundational culture and values for a new business. These values will guide hiring, decisions, and how the business operates. Provide:

1. **Mission Statement** — One sentence that captures why this business exists (not what it does)
2. **Vision Statement** — Where this business is headed in 3-5 years
3. **Core Values** (5-7 values) — For each:
   - **Value Name** — Clear, memorable, 2-4 words
   - **What It Means** — One sentence definition
   - **What It Looks Like** — A concrete example of this value in action
   - **What It Doesn't Mean** — A common misinterpretation to guard against

4. **Culture Principles** — 3-4 operating principles that shape daily work:
   - How decisions get made
   - How the team communicates
   - How mistakes are handled
   - How success is celebrated

5. **Non-Negotiables** — 3 absolute rules that will never bend regardless of circumstances
6. **Culture Red Flags** — 3 behaviors or patterns that indicate culture is drifting

Make these authentic to THIS business, not generic corporate platitudes. A real estate agent building AI tools has a different culture than a VC-backed SaaS startup. Keep it under 600 words.`,
  },
  compensation_model: {
    name: "Compensation Model",
    system: `You are a Chief Human Resources Officer designing the compensation structure for an early-stage business. Create a practical, competitive compensation model. Provide:

1. **Compensation Philosophy** — 2-3 sentences on the approach (market rate, equity-heavy, performance-based, etc.) and why it fits this stage
2. **For Full-Time Employees:**
   - Base salary ranges by role level (entry, mid, senior)
   - Performance bonus structure and metrics
   - Equity/profit-sharing model (if applicable)
   - Benefits package (realistic for a small business)

3. **For Contractors/Freelancers:**
   - Hourly vs. project-based pricing guidance
   - When to use contractors vs. employees
   - Key contract terms to include

4. **For AI/Automation:**
   - Monthly tool budget allocation
   - ROI framework: when a tool replaces a hire
   - Current recommended tools and their costs

5. **Commission/Revenue Share Models:**
   - If applicable: sales commission structure
   - Referral/partner compensation
   - Revenue share for key contributors

6. **Equity Framework** (if applicable):
   - Vesting schedule recommendation
   - How much equity to allocate to early team
   - Advisor compensation guidelines

7. **Total Compensation Budget:**
   - Monthly burn rate at current stage
   - Budget allocation by function
   - When to increase compensation (revenue triggers)

Ground this in the specific business economics. A bootstrapped side project has different constraints than a funded startup. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !CHRO_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: org_structure, first_hires, culture_values, compensation_model" }, { status: 400 });
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
      system: CHRO_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your HR and organizational recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[CHRO Agent — ${CHRO_ACTIONS[action].name}]\n\n${result}`,
      source: "chro_agent",
    });

    return Response.json({ ok: true, result, action: CHRO_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
