import { getSupabase } from "@/lib/supabase";

// POST — Save push subscription
export async function POST(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { subscription } = await request.json();
  if (!subscription?.endpoint || !subscription?.keys) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await sb
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        created_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

// DELETE — Remove push subscription
export async function DELETE(request: Request) {
  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { endpoint } = await request.json();
  if (!endpoint) return Response.json({ error: "Missing endpoint" }, { status: 400 });

  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
