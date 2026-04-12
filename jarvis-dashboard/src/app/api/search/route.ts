import { getSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });

  const sb = getSupabase();
  if (!sb) return Response.json({ results: [] });

  const pattern = `%${q}%`;

  const [projectsRes, notesRes, memoriesRes] = await Promise.all([
    sb.from("projects")
      .select("id, title, description, status, grade")
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(8),
    sb.from("project_notes")
      .select("id, project_id, content, source, created_at")
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(8),
    sb.from("memories")
      .select("id, fact, category, source")
      .ilike("fact", pattern)
      .limit(6),
  ]);

  const results: { type: string; id: string; title: string; subtitle: string; href: string }[] = [];

  for (const p of projectsRes.data || []) {
    results.push({
      type: "project",
      id: p.id,
      title: p.title,
      subtitle: `${p.status} · Grade ${p.grade}`,
      href: `/ideas/${p.id}`,
    });
  }

  for (const n of notesRes.data || []) {
    const preview = n.content.replace(/\[.*?\]\s*/, "").slice(0, 80);
    results.push({
      type: "note",
      id: n.id,
      title: preview,
      subtitle: n.source ? n.source.replace(/_/g, " ") : "Note",
      href: `/ideas/${n.project_id}`,
    });
  }

  for (const m of memoriesRes.data || []) {
    results.push({
      type: "memory",
      id: m.id,
      title: m.fact.slice(0, 80),
      subtitle: m.category,
      href: "#memory",
    });
  }

  return Response.json({ results });
}
