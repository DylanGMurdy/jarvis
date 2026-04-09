import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const BASE_SYSTEM = `You are JARVIS, Dylan Murdoch's personal AI Chief of Staff. Dylan is 31, lives in Eagle Mountain, Utah. He's a real estate agent at Narwhal Homes (Red Rock Real Estate) focused on new construction with 8-9 years experience. His real mission is building AI businesses to achieve financial freedom and work fully remote. He has a wife and kids — family time 6-8pm is sacred.

His schedule: Wake 7:45am, work 9:30-6:30pm, vibe coding after 8pm.

His 90-day goals:
1. Launch 1 AI product with real revenue
2. Master AI build tools
3. Generate $1k/mo from AI
4. Automate Narwhal ops

His top AI ideas (ranked):
- Grade A: AI real estate lead nurture for builders (BUILD THIS FIRST)
- Grade A: Jarvis-as-a-service for entrepreneurs ($99-299/mo)
- Grade B: AI home buyer chatbot
- Grade C: AI listing content generator

You are direct, strategic, proactive, and slightly witty. You call him "sir" occasionally like the real Jarvis. You help him stay focused on his highest-leverage activities, remind him of priorities, and push him toward action. Keep responses concise but impactful.`;

async function loadMemories(): Promise<string> {
  const sb = getSupabase();
  if (!sb) return "";

  try {
    const { data } = await sb
      .from("memories")
      .select("fact, category")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data || data.length === 0) return "";

    const grouped: Record<string, string[]> = {};
    for (const m of data) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m.fact);
    }

    let memoryBlock = "\n\nLEARNED MEMORIES (things Dylan has told you across past conversations):";
    for (const [category, facts] of Object.entries(grouped)) {
      memoryBlock += `\n[${category.toUpperCase()}]`;
      for (const fact of facts) {
        memoryBlock += `\n- ${fact}`;
      }
    }
    return memoryBlock;
  } catch {
    return "";
  }
}

function buildSystemPrompt(
  base: string,
  context?: {
    type: string;
    project?: Record<string, unknown>;
    goal?: Record<string, unknown>;
  }
): string {
  if (!context) return base;

  if (context.type === "project" && context.project) {
    const p = context.project;
    return `${base}

CURRENT CONTEXT: You are discussing a specific project with Dylan.

PROJECT DETAILS:
- Title: ${p.title}
- Category: ${p.category}
- Status: ${p.status}
- Grade: ${p.grade}
- Description: ${p.description}
- Revenue Goal: ${p.revenue_goal}
- Progress: ${p.progress}%

Stay focused on this project. Help Dylan make decisions, overcome blockers, and move it forward. Be specific and actionable.`;
  }

  if (context.type === "goal" && context.goal) {
    const g = context.goal;
    return `${base}

CURRENT CONTEXT: You are discussing a specific 90-day goal with Dylan.

GOAL DETAILS:
- Title: ${g.title}
- Target: ${g.target}
- Progress: ${g.progress}%
- Target Date: ${g.target_date}
- Milestones: ${g.milestones_summary}

Stay focused on this goal. Help Dylan track progress, plan next steps, and stay motivated. Be specific and actionable.`;
  }

  return base;
}

async function extractAndSaveMemories(
  messages: { role: string; content: string }[],
  apiKey: string
) {
  const sb = getSupabase();
  if (!sb || messages.length < 4) return;

  try {
    const conversation = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You extract key facts about the user "Dylan" from conversations with his AI assistant JARVIS. Return ONLY a JSON array. Each object: {"fact": "...", "category": "personal|business|health|goals|relationships|preferences|ideas", "confidence": 0.0-1.0}. Only extract facts Dylan explicitly states. Skip greetings, generic chat, anything JARVIS says that Dylan didn't confirm. Return [] if nothing worth remembering. No markdown fences.`,
      messages: [{ role: "user", content: `Extract key facts:\n\n${conversation}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return;

    const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
    const memories: { fact: string; category: string; confidence: number }[] = JSON.parse(cleaned);
    if (!Array.isArray(memories) || memories.length === 0) return;

    // Dedup
    const { data: existing } = await sb
      .from("memories")
      .select("fact")
      .order("created_at", { ascending: false })
      .limit(200);

    const existingFacts = new Set(
      (existing || []).map((m: { fact: string }) => m.fact.toLowerCase().trim())
    );

    const newMemories = memories.filter(
      (m) => m.fact && m.category && m.confidence >= 0.5 && !existingFacts.has(m.fact.toLowerCase().trim())
    );

    if (newMemories.length > 0) {
      await sb.from("memories").insert(
        newMemories.map((m) => ({
          fact: m.fact,
          category: m.category,
          source: "chat_extraction",
          confidence: m.confidence,
        }))
      );
    }
  } catch {
    // Silent — extraction is best-effort
  }
}

async function saveConversation(messages: { role: string; content: string }[]) {
  const sb = getSupabase();
  if (!sb || messages.length < 2) return;

  try {
    // Generate a short summary from the last few messages
    const lastFew = messages.slice(-4);
    const summary = lastFew
      .filter((m) => m.role === "user")
      .map((m) => m.content.slice(0, 80))
      .join(" | ");

    await sb.from("conversations").insert({
      messages,
      summary: summary || "Chat session",
      created_at: new Date().toISOString(),
    });
  } catch {
    // Silent
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json(
      {
        response:
          "JARVIS is standing by, sir. Add your Anthropic API key to .env.local to activate full AI capabilities. For now, I'm running in demo mode — but I'm still here to help you stay focused on what matters.",
      },
      { status: 200 }
    );
  }

  try {
    const { messages, context } = await request.json();

    // Load persistent memories and inject into system prompt
    const memories = await loadMemories();
    const systemPrompt = buildSystemPrompt(BASE_SYSTEM + memories, context);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const assistantResponse = textBlock ? textBlock.text : "No response generated.";

    // After responding, extract memories and save conversation in background
    const allMessages = [...messages, { role: "assistant", content: assistantResponse }];

    // Fire and forget — don't block the response
    if (allMessages.length >= 4) {
      extractAndSaveMemories(allMessages, apiKey).catch(() => {});
    }
    if (allMessages.length >= 2) {
      saveConversation(allMessages).catch(() => {});
    }

    return Response.json({ response: assistantResponse });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json({ response: `Error: ${message}` }, { status: 500 });
  }
}
