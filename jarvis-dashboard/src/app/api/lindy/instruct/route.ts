const WEBHOOK_URL = process.env.LINDY_WEBHOOK_URL || "";

function isConfigured(): boolean {
  return WEBHOOK_URL !== "" && !WEBHOOK_URL.startsWith("your-");
}

export async function POST(request: Request) {
  const { instruction } = await request.json();

  if (!instruction || typeof instruction !== "string") {
    return Response.json({ error: "instruction is required" }, { status: 400 });
  }

  if (!isConfigured()) {
    return Response.json({
      ok: false,
      message: "Instruction queued (LINDY_WEBHOOK_URL not configured — add it to .env.local)",
    });
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });

    console.log("[Lindy instruct] Sent to webhook, status:", res.status);

    return Response.json({ ok: true, message: "Instruction sent to Lindy" });
  } catch (err) {
    console.log("[Lindy instruct] Error:", err);
    return Response.json({ ok: false, message: "Failed to reach Lindy webhook" }, { status: 500 });
  }
}
