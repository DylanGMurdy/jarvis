import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const BASE_SYSTEM = `You are JARVIS, Dylan Murdock's personal AI Chief of Staff. Dylan is 31, lives in Eagle Mountain, Utah. He's a real estate agent at Narwhal Homes (Red Rock Real Estate) focused on new construction with 8-9 years experience. His real mission is building AI businesses to achieve financial freedom and work fully remote. He has a wife and kids — family time 6-8pm is sacred.

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

// GET — Load conversations (latest global or by ID)
export async function GET(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ messages: [], conversations: [] });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") || "global";
  const limit = parseInt(searchParams.get("limit") || "20");

  // Load a specific conversation by ID
  if (id) {
    const { data, error } = await sb
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return Response.json({ messages: [], conversation: null });
    }
    return Response.json({ messages: data.messages || [], conversation: data });
  }

  // Load conversation list (for the chat list page)
  if (searchParams.get("list") === "true") {
    const { data, error } = await sb
      .from("conversations")
      .select("id, title, summary, conversation_type, created_at, updated_at, messages")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) return Response.json({ conversations: [] });

    // Add preview (last message) to each conversation
    const conversations = (data || []).map((c) => {
      const msgs = c.messages as { role: string; content: string }[] || [];
      const lastMsg = msgs[msgs.length - 1];
      return {
        id: c.id,
        title: c.title || c.summary || "Chat",
        summary: c.summary || "",
        conversation_type: c.conversation_type || "global",
        created_at: c.created_at,
        updated_at: c.updated_at || c.created_at,
        message_count: msgs.length,
        preview: lastMsg ? lastMsg.content.slice(0, 100) : "",
        last_role: lastMsg?.role || "",
      };
    });

    return Response.json({ conversations });
  }

  // Load the most recent global conversation
  const { data, error } = await sb
    .from("conversations")
    .select("*")
    .or("conversation_type.eq.global,conversation_type.is.null")
    .not("summary", "like", "project:%")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return Response.json({ messages: [], conversation: null });
  }

  return Response.json({
    messages: data[0].messages || [],
    conversation: {
      id: data[0].id,
      title: data[0].title || data[0].summary || "Chat",
      summary: data[0].summary,
      conversation_type: data[0].conversation_type,
      updated_at: data[0].updated_at || data[0].created_at,
    },
  });
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
    const { messages, context, conversationId } = await request.json();

    // Load persistent memories and inject into system prompt
    const memories = await loadMemories();
    const systemPrompt = BASE_SYSTEM + memories;

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

    const allMessages = [...messages, { role: "assistant", content: assistantResponse }];

    // Save/update conversation in Supabase
    const sb = getSupabase();
    let savedConversationId = conversationId;

    if (sb) {
      // Generate title from first user message
      const firstUserMsg = allMessages.find((m: { role: string; content: string }) => m.role === "user");
      const autoTitle = firstUserMsg ? firstUserMsg.content.slice(0, 60) : "Chat";

      if (conversationId) {
        // Update existing conversation
        await sb.from("conversations")
          .update({
            messages: allMessages,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      } else {
        // Create new conversation
        const { data } = await sb.from("conversations")
          .insert({
            messages: allMessages,
            summary: autoTitle,
            title: autoTitle,
            conversation_type: context?.type === "project" ? "project" : "global",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (data) {
          savedConversationId = data.id;
        }
      }

      // Extract memories in background
      if (allMessages.length >= 4) {
        extractAndSaveMemories(allMessages, apiKey).catch(() => {});
      }
    }

    return Response.json({
      response: assistantResponse,
      conversationId: savedConversationId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json({ response: `Error: ${message}` }, { status: 500 });
  }
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
