import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const CTO_ACTIONS: Record<string, { name: string; system: string }> = {
  tech_stack: {
    name: "Tech Stack",
    system: `You are a Chief Technology Officer with deep experience shipping products at startups and scale-ups. Recommend the best tech stack for this project. Provide:

1. **Frontend** — framework, UI library, styling approach. Justify each choice.
2. **Backend** — language, framework, API style (REST/GraphQL). Justify.
3. **Database** — type (relational/document/graph), specific product, and why.
4. **Infrastructure** — hosting, CI/CD, monitoring. Keep it lean for a small team.
5. **Third-Party Services** — auth, payments, email, analytics — only what's needed.
6. **Why This Stack** — 3 sentences on why this combination wins for this specific project.

Optimize for speed-to-market, developer experience, and cost at early stage. No over-engineering. Format with clear headers. Keep it under 600 words.`,
  },
  build_roadmap: {
    name: "Build Roadmap",
    system: `You are a Chief Technology Officer planning the technical build for an early-stage product. Create a phased build roadmap. Provide:

**Phase 1: Foundation (Week 1-2)**
- Core architecture decisions
- Key deliverables with time estimates

**Phase 2: MVP Core (Week 3-4)**
- The features that must ship for first users
- Key deliverables with time estimates

**Phase 3: Polish & Launch (Week 5-6)**
- What turns the MVP into something shippable
- Key deliverables with time estimates

**Phase 4: Post-Launch (Week 7-8)**
- Iteration based on user feedback
- Key deliverables with time estimates

For each phase include: concrete milestones, estimated effort (days), dependencies, and the "done" criteria. End with a recommended team size and the single biggest technical risk per phase. Keep it under 700 words.`,
  },
  technical_risks: {
    name: "Technical Risks",
    system: `You are a Chief Technology Officer assessing technical risk for a new product. Identify the top technical risks and provide mitigation strategies. For each risk provide:

1. **Risk Name**
2. **Severity** (Critical / High / Medium / Low)
3. **Likelihood** (High / Medium / Low)
4. **Description** — what could go wrong and why
5. **Impact** — what happens if this risk materializes
6. **Mitigation** — specific actions to reduce or eliminate the risk
7. **Early Warning Signs** — how to detect this risk before it becomes a problem

Identify at least 5 risks spanning: architecture, scalability, security, third-party dependencies, and team/execution. End with a risk matrix summary and your top 3 recommended actions. Keep it under 600 words.`,
  },
  mvp_scope: {
    name: "MVP Scope",
    system: `You are a Chief Technology Officer defining the minimum viable product. Your job is to ruthlessly cut scope to the smallest thing that validates the core hypothesis. Provide:

1. **Core Hypothesis** — the one thing this MVP must prove (one sentence)
2. **Must-Have Features** (3-5 max) — each with a one-line description and why it's essential
3. **Nice-to-Have** (3-5) — features that feel important but can wait. Explain why they can wait.
4. **Explicitly Out of Scope** — things the founder might want but absolutely should NOT build yet
5. **Success Metrics** — 2-3 measurable criteria that prove the MVP worked
6. **Build Estimate** — realistic time for a solo developer or small team
7. **Launch Strategy** — how to get the MVP in front of the first 10 users

Be opinionated. Push back on scope creep. The best MVP is embarrassingly small. Keep it under 600 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !CTO_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: tech_stack, build_roadmap, technical_risks, mvp_scope" }, { status: 400 });
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
      system: CTO_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[CTO Agent — ${CTO_ACTIONS[action].name}]\n\n${result}`,
    });

    return Response.json({ ok: true, result, action: CTO_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
