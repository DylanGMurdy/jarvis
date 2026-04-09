import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST — extract memories from a conversation using Claude
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabase = getSupabase();

  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json({ extracted: 0, error: "API key not configured" });
  }
  if (!supabase) {
    return Response.json({ extracted: 0, error: "Supabase not configured" });
  }

  try {
    const { messages } = await request.json();

    if (!messages || messages.length < 2) {
      return Response.json({ extracted: 0 });
    }

    // Format conversation for extraction
    const conversation = messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You extract key facts about the user "Dylan" from conversations with his AI assistant JARVIS. Return ONLY a JSON array of memory objects. Each object must have:
- "fact": a concise statement of the fact (1-2 sentences max)
- "category": one of "personal", "business", "health", "goals", "relationships", "preferences", "ideas"
- "confidence": 0.0 to 1.0 (how confident you are this is a real fact, not hypothetical)

Rules:
- Only extract facts Dylan explicitly states or strongly implies about himself
- Skip generic conversation, greetings, questions Dylan asks
- Skip anything JARVIS says that Dylan didn't confirm
- Deduplicate — don't extract the same fact twice
- If nothing worth remembering, return an empty array []
- Return ONLY valid JSON, no markdown code fences`,
      messages: [
        {
          role: "user",
          content: `Extract key facts about Dylan from this conversation:\n\n${conversation}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ extracted: 0 });
    }

    let memories: { fact: string; category: string; confidence: number }[];
    try {
      // Strip potential markdown code fences
      const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
      memories = JSON.parse(cleaned);
    } catch {
      return Response.json({ extracted: 0, error: "Failed to parse extraction" });
    }

    if (!Array.isArray(memories) || memories.length === 0) {
      return Response.json({ extracted: 0 });
    }

    // Check for duplicates against existing memories
    const { data: existing } = await supabase
      .from("memories")
      .select("fact")
      .order("created_at", { ascending: false })
      .limit(200);

    const existingFacts = new Set(
      (existing || []).map((m: { fact: string }) => m.fact.toLowerCase().trim())
    );

    const newMemories = memories.filter(
      (m) =>
        m.fact &&
        m.category &&
        m.confidence >= 0.5 &&
        !existingFacts.has(m.fact.toLowerCase().trim())
    );

    if (newMemories.length === 0) {
      return Response.json({ extracted: 0 });
    }

    const { error } = await supabase.from("memories").insert(
      newMemories.map((m) => ({
        fact: m.fact,
        category: m.category,
        source: "chat_extraction",
        confidence: m.confidence,
      }))
    );

    if (error) {
      return Response.json({ extracted: 0, error: error.message }, { status: 500 });
    }

    return Response.json({ extracted: newMemories.length, memories: newMemories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ extracted: 0, error: message }, { status: 500 });
  }
}
