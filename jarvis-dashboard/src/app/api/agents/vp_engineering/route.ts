import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";

type Action = "architecture_plan" | "sprint_plan" | "tech_debt_audit" | "api_design";

const SYSTEM_PROMPT = `You are the VP of Engineering agent for JARVIS, a PE business empire management system owned by Dylan Murdoch.

Dylan builds with Next.js 16 (App Router), Supabase (Postgres + Auth), Tailwind CSS, and deploys on Netlify. He uses Claude Code as his primary development tool. His stack is TypeScript-first, serverless, and optimized for a solo developer shipping fast.

Your role: Make sound technical decisions that balance speed with quality. Favor simple architecture over clever architecture. Recommend patterns that a solo dev can maintain. Always consider: can Claude Code build this in one session? If the answer is no, break it down until each piece can be built in one session.`;

const ACTION_PROMPTS: Record<Action, (title: string, desc: string) => string> = {
  architecture_plan: (title, desc) => `Design the technical architecture for "${title}".

Project description: ${desc}

Tech stack context: Next.js 16 (App Router), Supabase, Tailwind, Netlify, TypeScript.

Provide:
1. **Architecture Overview** — high-level description of how the system works (describe the diagram: boxes, arrows, data flow)
2. **Database Schema** — tables, columns, types, relationships (Supabase/Postgres)
3. **API Routes** — list of Next.js API routes needed with HTTP method, path, and purpose
4. **Frontend Pages** — list of pages/views needed with key components
5. **External Integrations** — third-party APIs, webhooks, or services needed
6. **Data Flow** — how data moves through the system for the 3 most important user actions
7. **Infrastructure** — hosting, environment variables, scheduled functions, background jobs
8. **Security Considerations** — auth, RLS policies, input validation, rate limiting

Keep it deployable on Netlify with Supabase. No Docker, no Redis, no complex infrastructure.`,

  sprint_plan: (title, desc) => `Create a 2-week sprint plan for "${title}".

Project description: ${desc}

Provide:
1. **Sprint Goal** — one sentence describing what's shippable after 2 weeks
2. **Week 1 Tasks** — daily breakdown (Mon-Fri), each task with:
   - Task name and description
   - Story points (1 = 1 hour, 3 = half day, 5 = full day, 8 = 2 days)
   - Acceptance criteria (how to know it's done)
   - Dependencies (what must be done first)
3. **Week 2 Tasks** — same format
4. **Total Story Points** — sum and assessment (is this realistic for a solo dev doing 3-4 hours/day?)
5. **Risk Items** — tasks most likely to take longer than estimated
6. **Definition of Done** — checklist for the sprint (tests passing, deployed, etc.)
7. **Claude Code Sessions** — break work into sessions that can each be completed with one Claude Code prompt

Assume Dylan has 3-4 focused dev hours per day. Total capacity: ~30-40 story points per sprint.`,

  tech_debt_audit: (title, desc) => `Identify tech debt risks for "${title}" and how to avoid them from day one.

Project description: ${desc}

Provide:
1. **Top 5 Tech Debt Risks** — for each:
   - What the debt looks like
   - Why it happens (common shortcuts that cause it)
   - Prevention strategy (what to do from day one)
   - Cost of fixing later vs doing it right now
2. **Architecture Decisions to Lock In Early** — 3 decisions that are cheap now but expensive to change later
3. **Testing Strategy** — minimum viable testing approach (what to test, what to skip)
4. **Code Organization** — file structure and naming conventions to follow from the start
5. **Database Migration Strategy** — how to handle schema changes safely
6. **Dependency Management** — which dependencies to pin, which to keep loose
7. **Performance Baselines** — what to measure from day one so you can catch regressions

Focus on pragmatic prevention, not perfect engineering. Dylan ships fast — the goal is avoiding the debt that actually slows you down.`,

  api_design: (title, desc) => `Design the core API endpoints for "${title}".

Project description: ${desc}

For each endpoint provide:
1. **Method and Path** — e.g., POST /api/widgets
2. **Purpose** — what this endpoint does
3. **Request Body** — JSON schema with types and required fields
4. **Response Body** — JSON schema for success and error responses
5. **Authentication** — required or public
6. **Rate Limiting** — suggested limits
7. **Example** — one curl command showing usage

Also provide:
- **API Design Principles** — 3-5 rules for consistency (naming, pagination, error format)
- **Webhook Endpoints** — any incoming webhooks needed
- **Internal vs External** — which endpoints are internal (dashboard only) vs external (third-party consumption)
- **Versioning Strategy** — how to handle breaking changes

Use Next.js App Router convention: src/app/api/[resource]/route.ts`,
};

export async function POST(request: Request) {
  try {
    const { action, projectId, projectTitle, projectDescription } = await request.json();

    if (!action || !ACTION_PROMPTS[action as Action]) {
      return Response.json({ error: "Invalid action. Use: architecture_plan, sprint_plan, tech_debt_audit, or api_design" }, { status: 400 });
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
        architecture_plan: "Architecture Plan",
        sprint_plan: "Sprint Plan",
        tech_debt_audit: "Tech Debt Audit",
        api_design: "API Design",
      };
      await sb.from("project_notes").insert({
        id: `vp-eng-${action}-${Date.now()}`,
        project_id: projectId,
        content: `[VP Engineering — ${labels[action as Action]}]\n${output}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: output, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
