import Anthropic from "@anthropic-ai/sdk";

interface AgentResult { agentName: string; result: string }

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: "API key not configured" }, { status: 500 });

  try {
    const { allResults, projectTitle } = (await request.json()) as { allResults: AgentResult[]; projectTitle: string };

    if (!Array.isArray(allResults) || allResults.length === 0) {
      return Response.json({ ok: false, error: "allResults is required" }, { status: 400 });
    }

    const compiled = allResults.map((r) => `## ${r.agentName}\n${r.result}`).join("\n\n---\n\n");

    const system = `You are JARVIS, the AI chief of staff. You just received analysis from ${allResults.length} specialist agents on the project "${projectTitle}". Synthesize their outputs into a single executive summary.

Return ONLY a valid JSON object (no markdown fences, no explanation) with this exact structure:
{
  "consensus": ["bullet 1", "bullet 2", "bullet 3"],
  "conflicts": ["conflict 1", "conflict 2"],
  "recommendations": ["action 1", "action 2", "action 3", "action 4", "action 5"],
  "confidence_score": 8,
  "verdict": "One sentence verdict on this project's overall viability and the team's overall confidence."
}

Rules:
- consensus: 3-5 bullets where most agents agreed
- conflicts: 2-4 bullets flagging where agents disagreed or raised concerns
- recommendations: 5 prioritized next steps
- confidence_score: integer 1-10 representing the team's overall confidence in this project
- verdict: one sharp sentence`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: compiled }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();

    let parsed: { consensus: string[]; conflicts: string[]; recommendations: string[]; confidence_score: number; verdict: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return raw text
      return Response.json({
        ok: true,
        consensus: [],
        conflicts: [],
        recommendations: [],
        confidence_score: 0,
        verdict: cleaned.slice(0, 200),
        raw: text,
      });
    }

    return Response.json({
      ok: true,
      consensus: parsed.consensus || [],
      conflicts: parsed.conflicts || [],
      recommendations: parsed.recommendations || [],
      confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0,
      verdict: parsed.verdict || "",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
