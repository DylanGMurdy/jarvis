import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { query, projectId } = await request.json();

    if (!query || !projectId) {
      return Response.json({ error: "query and projectId are required" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "PERPLEXITY_API_KEY not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a business research assistant. Provide detailed, factual research with sources. Format your response with clear sections and bullet points.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Perplexity API error: ${res.status} ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || "No response from Perplexity";
    const citations = data.citations || [];

    const fullResult = citations.length > 0
      ? `${result}\n\n---\nSources:\n${citations.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`
      : result;

    // Save to project notes
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from("project_notes").insert({
        id: `research-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        project_id: projectId,
        content: `[Research Agent] ${query}\n\n${fullResult}`,
        created_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, result: fullResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
