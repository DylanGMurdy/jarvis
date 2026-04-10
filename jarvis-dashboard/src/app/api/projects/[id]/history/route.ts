import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  if (!sb) return Response.json({ conversations: [] });

  // Get all conversations linked to this project (by project_id column OR summary tag)
  const { data, error } = await sb
    .from("conversations")
    .select("id, title, summary, messages, conversation_type, created_at, updated_at")
    .or(`project_id.eq.${id},summary.eq.project:${id}`)
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ conversations: [], error: error.message });

  const conversations = (data || []).map((c) => {
    const msgs = (c.messages as { role: string; content: string }[]) || [];
    const firstUser = msgs.find((m) => m.role === "user");
    return {
      id: c.id,
      title: c.title || c.summary || "Chat",
      message_count: msgs.length,
      preview: firstUser ? firstUser.content.slice(0, 120) : msgs[0]?.content?.slice(0, 120) || "",
      messages: msgs,
      created_at: c.created_at,
      updated_at: c.updated_at || c.created_at,
    };
  });

  return Response.json({ conversations });
}
