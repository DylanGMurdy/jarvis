import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const ANALYSTS: Record<string, { name: string; system: string }> = {
  devils_advocate: {
    name: "Devil's Advocate",
    system: `You are a ruthless Devil's Advocate analyst. Your job is to tear apart this business idea and find every flaw, blind spot, and weakness. Be blunt, direct, and constructively brutal. Challenge every assumption. Point out what could go wrong. Identify hidden risks the founder isn't seeing. Format your response with clear sections and bullet points. Keep it under 500 words.`,
  },
  market_analyst: {
    name: "Market Analyst",
    system: `You are a sharp Market Analyst. Analyze the market opportunity for this project. Cover: target market size, competitive landscape, timing (why now?), customer acquisition challenges, pricing validation, and market trends that help or hurt this idea. Use data-driven reasoning where possible. Format your response with clear sections and bullet points. Keep it under 500 words.`,
  },
  risk_assessor: {
    name: "Risk Assessor",
    system: `You are a pragmatic Risk Assessor. Evaluate this project across these dimensions: technical risk, market risk, execution risk, financial risk, and timeline risk. For each, give a risk level (Low/Medium/High) and explain why. Then give an overall risk score and your top 3 recommendations to de-risk the project. Format your response with clear sections. Keep it under 500 words.`,
  },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { analyst } = await request.json();
  if (!analyst || !ANALYSTS[analyst]) {
    return Response.json({ error: "Invalid analyst. Use: devils_advocate, market_analyst, risk_assessor" }, { status: 400 });
  }

  const [projectRes, tasksRes, notesRes] = await Promise.all([
    sb.from("projects").select("*").eq("id", id).single(),
    sb.from("project_tasks").select("title, done").eq("project_id", id),
    sb.from("project_notes").select("content").eq("project_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  const project = projectRes.data;
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const tasks = tasksRes.data || [];
  const notes = notesRes.data || [];

  const context = `PROJECT: ${project.title}
Category: ${project.category}
Status: ${project.status}
Grade: ${project.grade}
Revenue Goal: ${project.revenue_goal}
Progress: ${project.progress}%

DESCRIPTION:
${project.description}

TASKS:
${tasks.map((t: { title: string; done: boolean }) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "None"}

RECENT NOTES:
${notes.map((n: { content: string }) => n.content).join("\n---\n") || "None"}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: ANALYSTS[analyst].system,
      messages: [{ role: "user", content: `Analyze this project:\n\n${context}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const analysis = textBlock && textBlock.type === "text" ? textBlock.text : "No analysis generated.";

    // Save analysis as a project note
    await sb.from("project_notes").insert({
      project_id: id,
      content: `[War Room — ${ANALYSTS[analyst].name}]\n\n${analysis}`,
    });

    return Response.json({ success: true, analyst: ANALYSTS[analyst].name, analysis });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
