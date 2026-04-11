import { runDailyAgent } from "@/lib/daily-agent";

export async function POST() {
  try {
    const result = await runDailyAgent();
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
