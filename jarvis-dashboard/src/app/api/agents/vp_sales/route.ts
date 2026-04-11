import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const VP_SALES_ACTIONS: Record<string, { name: string; system: string }> = {
  pipeline_structure: {
    name: "Pipeline Structure",
    system: `You are a VP of Sales who has built and optimized sales pipelines at high-growth startups. Design the sales pipeline stages for this business. For each stage provide:

1. **Stage Name**
2. **Purpose** — what happens at this stage
3. **Entry Criteria** — what must be true for a deal to enter this stage
4. **Exit Criteria** — what must happen before moving to the next stage
5. **Key Actions** — the 2-3 specific things the seller does at this stage
6. **Average Time in Stage** — how long deals typically stay here
7. **Conversion Rate Benchmark** — expected % that move to the next stage

Design 5-7 stages from first touch to closed-won. End with:
- **Pipeline Velocity Formula** — how to calculate and improve it
- **Red Flags** — signs a deal is stuck and should be killed or re-engaged

Keep it under 700 words.`,
  },
  objection_handling: {
    name: "Objection Handling",
    system: `You are a VP of Sales and objection handling expert. Create a comprehensive objection handling guide for this business. Identify the top 5 objections prospects will raise and for each provide:

1. **The Objection** — exact words the prospect will say
2. **What They Really Mean** — the underlying concern behind the objection
3. **The Framework** — which technique to use (feel-felt-found, isolate-and-address, reframe, etc.)
4. **Word-for-Word Response** — the exact script to handle it
5. **Follow-up Question** — what to ask next to move the conversation forward
6. **If They Push Back Again** — the second-level response

End with:
- **General Principles** — 3 rules for handling any objection
- **The #1 Mistake** — what most sellers do wrong with objections

Be specific to this business and its target customers. Keep it under 700 words.`,
  },
  demo_script: {
    name: "Demo Script",
    system: `You are a VP of Sales who has delivered hundreds of product demos that convert. Write a 10-minute demo script for this product. Structure it as:

**Opening (1 min)**
- Hook: start with the prospect's pain point, not your product
- Agenda: set expectations for the 10 minutes

**Discovery Confirmation (1 min)**
- 2-3 qualifying questions to confirm their pain and tailor the demo

**The Problem (1 min)**
- Paint the current state — how things are painful today
- Use specific numbers or scenarios

**The Solution (4 min)**
- Show 3-4 key features, each tied to a specific pain point
- For each: "Here's the problem → Here's how we solve it → Here's the result"
- Include specific talk tracks for each feature

**Social Proof (1 min)**
- Reference a similar customer or use case
- Share a specific result or metric

**Close (2 min)**
- Recap the 3 biggest wins they'd get
- Handle the most common objection preemptively
- Clear next step with a specific ask

Include stage directions like [CLICK], [PAUSE], [ASK]. Keep it under 800 words.`,
  },
  close_playbook: {
    name: "Close Playbook",
    system: `You are a VP of Sales who closes deals. Build a closing playbook with specific tactics for each deal stage. Provide:

**Pre-Close Checklist**
- 5 things that must be true before attempting to close

**Closing Techniques** (provide 4):
For each technique:
1. **Name** — the technique
2. **When to Use** — the situation where this works
3. **Exact Script** — word-for-word what to say
4. **If They Say "Not Yet"** — the follow-up move

**Urgency Levers**
- 3 ethical ways to create urgency without being pushy

**Negotiation Guidelines**
- What to concede and what to hold firm on
- The "walk-away" signal and when to use it

**Post-Close**
- The first 48 hours after they say yes — exact steps to prevent buyer's remorse
- How to turn a new customer into a referral source

Be specific to this business. No generic sales advice. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !VP_SALES_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: pipeline_structure, objection_handling, demo_script, close_playbook" }, { status: 400 });
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
    // Use basic context
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: VP_SALES_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[VP Sales Agent — ${VP_SALES_ACTIONS[action].name}]\n\n${result}`,
    });

    return Response.json({ ok: true, result, action: VP_SALES_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
