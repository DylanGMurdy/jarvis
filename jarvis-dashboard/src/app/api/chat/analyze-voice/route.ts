import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const sb = getSupabase();

  // Load project titles for matching
  let projectList = "";
  if (sb) {
    const { data } = await sb.from("projects").select("id, title, category, description").order("created_at");
    if (data?.length) {
      projectList = data.map((p) => `- ID: ${p.id} | Title: "${p.title}" | Category: ${p.category} | ${p.description?.slice(0, 80) || ""}`).join("\n");
    }
  }

  const { transcript } = await request.json();
  if (!transcript?.trim()) {
    return Response.json({ error: "No transcript" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are JARVIS, analyzing a voice transcript from Dylan. Classify it into ONE of these types and return ONLY valid JSON with no markdown fences.

EXISTING PROJECTS:
${projectList || "(none)"}

Classification rules:
1. "personal" — casual updates, day recap, feelings, family, health, anything not about a project
2. "existing_project" — clearly references an existing project above (by name, topic, or keyword)
3. "new_idea" — describes something that could become a new project/business idea
4. "ambiguous" — could go either way, need to ask

Return format:
{"type": "personal|existing_project|new_idea|ambiguous", "projectMatch": "proj-id or null", "projectMatchTitle": "title or null", "suggestedTitle": "for new ideas only", "suggestedCategory": "AI Business|Real Estate|Side Hustles|Personal", "clarifyQuestion": "only if ambiguous — ONE short question", "summary": "1-2 sentence summary of what Dylan said", "memories": [{"fact": "...", "category": "personal|business|ideas|goals|health"}], "tasks": ["extracted task if any"], "response": "JARVIS's conversational response to Dylan (1-3 sentences, direct, strategic, call him sir occasionally)"}`,
      messages: [{ role: "user", content: transcript }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No response" }, { status: 500 });
    }

    const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    // Auto-save memories for personal updates
    if (sb && analysis.memories?.length > 0) {
      const validMemories = analysis.memories.filter(
        (m: { fact: string; category: string }) => m.fact?.trim()
      );
      if (validMemories.length > 0) {
        await sb.from("memories").insert(
          validMemories.map((m: { fact: string; category: string }) => ({
            fact: m.fact,
            category: m.category || "personal",
            source: "voice_extraction",
            confidence: 0.8,
          }))
        );
      }
    }

    return Response.json(analysis);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
