import webpush from "web-push";
import { getSupabase } from "@/lib/supabase";

// Configure VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:dylan@jarvis.ai",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// POST — Send push notification to all subscribed devices
export async function POST(request: Request) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { title, body, url, tag } = await request.json();

  // Load all push subscriptions
  const { data: subscriptions, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, keys");

  if (error || !subscriptions || subscriptions.length === 0) {
    return Response.json({ error: "No subscriptions found" }, { status: 404 });
  }

  const payload = JSON.stringify({
    title: title || "JARVIS",
    body: body || "You have a new update",
    url: url || "/",
    tag: tag || "jarvis-update",
  });

  // Send to all subscriptions
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          payload
        );
        return { endpoint: sub.endpoint, success: true };
      } catch (err: unknown) {
        // Remove invalid subscriptions (410 Gone, 404 Not Found)
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        return { endpoint: sub.endpoint, success: false, error: String(err) };
      }
    })
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;

  return Response.json({ sent, total: subscriptions.length });
}
