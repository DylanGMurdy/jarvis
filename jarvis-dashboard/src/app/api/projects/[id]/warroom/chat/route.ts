import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const { message, warRoomContext } = await request.json();
  if (!message) return Response.json({ error: "message is required" }, { status: 400 });

  const systemPrompt = `You are Jarvis in the War Room. Dylan is asking you questions about the analysis his executive team just completed. You have access to all agent reports below.

When answering:
- Reference specific agents by name (e.g. "The CMO's analysis suggests..." or "The CTO flagged this as a risk...")
- Be direct and concise — Dylan wants answers, not fluff
- If agents disagree, present both sides and give your recommendation
- If Dylan asks you to re-run an agent with different instructions, include this JSON block at the END of your response on its own line:
  {"rerun": true, "agent": "agent_key", "newInstructions": "the new instructions"}
  Valid agent keys: cmo, cto, cfo, cso, coo, vp_sales, vp_finance, sdr, partnerships, data_analytics, clo, chro

AGENT REPORTS:
${warRoomContext || "No agent reports available yet. Run the War Room deploy first."}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const fullText = textBlock && textBlock.type === "text" ? textBlock.text : "No response generated.";

    // Check if response includes a rerun instruction
    let responseText = fullText;
    let rerun = false;
    let agent = "";
    let newInstructions = "";

    const rerunMatch = fullText.match(/\{"rerun"\s*:\s*true\s*,\s*"agent"\s*:\s*"([^"]+)"\s*,\s*"newInstructions"\s*:\s*"([^"]+)"\s*\}/);
    if (rerunMatch) {
      rerun = true;
      agent = rerunMatch[1];
      newInstructions = rerunMatch[2];
      responseText = fullText.replace(rerunMatch[0], "").trim();
    }

    return Response.json({ response: responseText, rerun, agent, newInstructions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
