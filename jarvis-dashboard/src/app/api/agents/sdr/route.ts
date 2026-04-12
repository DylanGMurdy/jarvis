import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const SDR_ACTIONS: Record<string, { name: string; system: string }> = {
  cold_outreach: {
    name: "Cold Outreach Sequence",
    system: `You are an elite Sales Development Rep who books 15+ meetings per week. Write a 5-touch cold outreach sequence for this business. Structure it as:

**Touch 1: Cold Email (Day 1)**
- Subject line (under 50 chars, no spam triggers)
- Body (under 120 words) — lead with their pain, not your product
- CTA: one clear ask

**Touch 2: LinkedIn Connection + Note (Day 2)**
- Connection request note (under 300 chars)
- What to do if they accept vs ignore

**Touch 3: Follow-up Email (Day 4)**
- Subject line (reply to original thread)
- Body — add new value, share a relevant insight or stat
- CTA: lower commitment ask

**Touch 4: Phone/Voicemail (Day 6)**
- 30-second voicemail script
- What to say if they pick up (15-second opener)

**Touch 5: Break-up Email (Day 9)**
- Subject line with curiosity gap
- Body — respect their time, leave the door open, create subtle FOMO

For each touch include the exact words to use. No corporate jargon. Be conversational and specific to this business. Keep it under 800 words.`,
  },
  lead_qualification: {
    name: "Lead Qualification Framework",
    system: `You are a Sales Development Rep who only passes high-quality leads to closers. Create a lead qualification framework customized for this business. Provide:

**Framework Choice** — recommend BANT, MEDDIC, CHAMP, or a custom hybrid. Explain why.

**Qualification Criteria** (for each dimension):
1. **Criterion name**
2. **What to ask** — the exact discovery question
3. **Green flag** — the answer that means "qualified"
4. **Yellow flag** — the answer that means "needs nurturing"
5. **Red flag** — the answer that means "disqualify"
6. **Scoring** — points to assign (build a 0-100 scoring model)

**Qualification Stages:**
- MQL criteria (what makes a lead worth calling)
- SQL criteria (what makes a lead worth a demo)
- Opportunity criteria (what makes a lead worth a proposal)

**Disqualification Script** — how to politely end conversations with bad-fit prospects

**Handoff Template** — the information the SDR passes to the closer for each qualified lead

Keep it under 700 words.`,
  },
  follow_up_sequences: {
    name: "Follow-up Sequences",
    system: `You are a Sales Development Rep who never lets a lead go cold. Write 3 different follow-up sequences for prospects at different stages. For each sequence provide the exact emails/messages:

**Sequence 1: Warm Lead (showed interest but went dark)**
- 4 touches over 14 days
- Strategy: re-engage with value, not pressure
- Each touch: channel, subject/hook, full message, CTA

**Sequence 2: Post-Demo (had a good call but hasn't decided)**
- 5 touches over 21 days
- Strategy: build urgency and reduce risk
- Each touch: channel, subject/hook, full message, CTA

**Sequence 3: Long-Term Nurture (not ready now, maybe in 3-6 months)**
- 4 touches over 90 days
- Strategy: stay top-of-mind with insights, not pitches
- Each touch: channel, subject/hook, full message, CTA

Include timing between touches. Every message must be sendable as-is — no [PLACEHOLDER] brackets. Be specific to this business. Keep it under 800 words.`,
  },
  outreach_personalization: {
    name: "Personalized Outreach",
    system: `You are a Sales Development Rep who writes outreach so personalized that prospects think you know them. Given the project context, write a hyper-personalized first touch for 5 different prospect archetypes. For each:

1. **Prospect Archetype** — title, company type, what they care about
2. **Research Hook** — what you'd look for on their LinkedIn/website to personalize
3. **Personalized Email** — full email with subject line, body referencing something specific about their world, and CTA
4. **Personalized LinkedIn DM** — shorter version for LinkedIn
5. **Why This Works** — the psychology behind this approach

The messages must feel like they were written for one person, not mail-merged. Reference specific industry pain points, common titles, and realistic scenarios. No generic templates. Keep it under 700 words.`,
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { action, projectId, projectTitle, projectDescription } = await request.json();

  if (!action || !SDR_ACTIONS[action]) {
    return Response.json({ error: "Invalid action. Use: cold_outreach, lead_qualification, follow_up_sequences, outreach_personalization" }, { status: 400 });
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
      system: SDR_ACTIONS[action].system,
      messages: [{ role: "user", content: `Analyze this project and provide your recommendations:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result = textBlock && textBlock.type === "text" ? textBlock.text : "No output generated.";

    await sb.from("project_notes").insert({
      project_id: projectId,
      content: `[SDR Agent — ${SDR_ACTIONS[action].name}]\n\n${result}`,
    });

    // Route external-facing outreach through approval queue
    const OUTREACH_ACTIONS = ["cold_outreach", "follow_up_sequences", "outreach_personalization"];
    let approvalNote = "";
    if (OUTREACH_ACTIONS.includes(action)) {
      await sb.from("approval_queue").insert({
        project_id: projectId,
        project_title: projectTitle,
        action_type: "send_email",
        description: `SDR Agent wants to send outreach: ${SDR_ACTIONS[action].name} for "${projectTitle}"`,
        payload: { agent: "sdr", action, content: result },
        status: "pending",
      });
      approvalNote = "\n\n---\nThis has been sent to your approval queue.";
    }

    return Response.json({ ok: true, result: result + approvalNote, action: SDR_ACTIONS[action].name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
