import { Client } from "@notionhq/client";
import { getSupabase } from "@/lib/supabase";

function getNotion(): Client | null {
  const token = process.env.NOTION_API_KEY;
  if (!token || token === "your-notion-api-key") return null;
  return new Client({ auth: token });
}

function getDatabaseId(): string | null {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id || id === "your-notion-database-id") return null;
  return id;
}

// GET — Check Notion connection status
export async function GET() {
  const notion = getNotion();
  const dbId = getDatabaseId();
  if (!notion || !dbId) {
    return Response.json({ connected: false, error: "Notion not configured. Set NOTION_API_KEY and NOTION_DATABASE_ID in .env.local" });
  }

  try {
    // Verify connection by retrieving the database
    const db = await notion.databases.retrieve({ database_id: dbId });
    const title = "title" in db && Array.isArray(db.title) && db.title.length > 0
      ? (db.title[0] as { plain_text?: string }).plain_text || "Untitled"
      : "Untitled";
    return Response.json({ connected: true, database: title });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ connected: false, error: msg });
  }
}

// POST — Sync a single project TO Notion (push)
export async function POST(request: Request) {
  const notion = getNotion();
  const dbId = getDatabaseId();
  if (!notion || !dbId) {
    return Response.json({ error: "Notion not configured" }, { status: 200 });
  }

  const sb = getSupabase();
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const { projectId } = await request.json();

    const { data: project, error } = await sb
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Search for existing page by title
    const searchResults = await notion.search({
      query: project.title,
      filter: { property: "object", value: "page" },
    });

    const existingPage = searchResults.results.find((page) => {
      if (!("properties" in page)) return false;
      const titleProp = page.properties.Name || page.properties.title;
      if (!titleProp || !("title" in titleProp)) return false;
      const titleArr = titleProp.title as { plain_text: string }[];
      return titleArr.length > 0 && titleArr[0].plain_text === project.title;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = {
      Name: { title: [{ text: { content: project.title } }] },
      Status: { select: { name: project.status } },
      Category: { select: { name: project.category } },
      Grade: { select: { name: project.grade } },
      Description: { rich_text: [{ text: { content: (project.description || "").slice(0, 2000) } }] },
      Progress: { number: project.progress },
      "Revenue Goal": { rich_text: [{ text: { content: (project.revenue_goal || "").slice(0, 2000) } }] },
    };

    if (existingPage) {
      await notion.pages.update({ page_id: existingPage.id, properties });
      return Response.json({ action: "updated", notion_id: existingPage.id });
    } else {
      const page = await notion.pages.create({ parent: { database_id: dbId }, properties });
      return Response.json({ action: "created", notion_id: page.id });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// PUT — Sync ALL projects to Notion
export async function PUT() {
  const notion = getNotion();
  const dbId = getDatabaseId();
  const sb = getSupabase();

  if (!notion || !dbId) return Response.json({ error: "Notion not configured" });
  if (!sb) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const { data: projects } = await sb
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });

    if (!projects || projects.length === 0) return Response.json({ synced: 0 });

    let synced = 0;
    for (const project of projects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = {
        Name: { title: [{ text: { content: project.title } }] },
        Status: { select: { name: project.status } },
        Category: { select: { name: project.category } },
        Grade: { select: { name: project.grade } },
        Description: { rich_text: [{ text: { content: (project.description || "").slice(0, 2000) } }] },
        Progress: { number: project.progress },
        "Revenue Goal": { rich_text: [{ text: { content: (project.revenue_goal || "").slice(0, 2000) } }] },
      };

      // Search for existing
      const searchResults = await notion.search({
        query: project.title,
        filter: { property: "object", value: "page" },
      });

      const existing = searchResults.results.find((page) => {
        if (!("properties" in page)) return false;
        const titleProp = page.properties.Name || page.properties.title;
        if (!titleProp || !("title" in titleProp)) return false;
        const titleArr = titleProp.title as { plain_text: string }[];
        return titleArr.length > 0 && titleArr[0].plain_text === project.title;
      });

      if (existing) {
        await notion.pages.update({ page_id: existing.id, properties });
      } else {
        await notion.pages.create({ parent: { database_id: dbId }, properties });
      }
      synced++;
    }

    return Response.json({ synced });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
