interface LindyUpdate {
  id: string;
  summary: string;
  emails_handled: number;
  tasks_completed: number;
  flags: string[];
  raw_payload: Record<string, unknown>;
  created_at: string;
}

// In-memory store — persists across requests within the same serverless instance.
// For durable storage, replace with a database (Vercel KV, Supabase, etc.)
const updates: LindyUpdate[] = [];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const update: LindyUpdate = {
      id: crypto.randomUUID(),
      summary: body.summary || "",
      emails_handled: body.emails_handled || 0,
      tasks_completed: body.tasks_completed || 0,
      flags: body.flags || [],
      raw_payload: body,
      created_at: new Date().toISOString(),
    };

    updates.push(update);
    console.log("[Lindy update] Saved:", update.summary.slice(0, 80));

    return Response.json({ ok: true, id: update.id });
  } catch (err) {
    console.log("[Lindy update] Error:", err);
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  const latest = updates.length > 0 ? updates[updates.length - 1] : null;
  return Response.json({ latest, total: updates.length });
}
