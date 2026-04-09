import Anthropic from "@anthropic-ai/sdk";

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

function buildSystemPrompt(context?: {
  type: string;
  project?: Record<string, unknown>;
  goal?: Record<string, unknown>;
}): string {
  if (!context) return BASE_SYSTEM;

  if (context.type === "project" && context.project) {
    const p = context.project;
    return `${BASE_SYSTEM}

CURRENT CONTEXT: You are discussing a specific project with Dylan. Focus all your advice on this project.

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
    return `${BASE_SYSTEM}

CURRENT CONTEXT: You are discussing a specific 90-day goal with Dylan. Focus all your advice on this goal.

GOAL DETAILS:
- Title: ${g.title}
- Target: ${g.target}
- Progress: ${g.progress}%
- Target Date: ${g.target_date}
- Milestones: ${g.milestones_summary}

Stay focused on this goal. Help Dylan track progress, plan next steps, and stay motivated. Be specific and actionable.`;
  }

  return BASE_SYSTEM;
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
    const systemPrompt = buildSystemPrompt(context);

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
    return Response.json({
      response: textBlock ? textBlock.text : "No response generated.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json({ response: `Error: ${message}` }, { status: 500 });
  }
}
