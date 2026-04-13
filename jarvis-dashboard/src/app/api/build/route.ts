import { NextRequest, NextResponse } from "next/server";

// ─── CORS ─────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-jarvis-secret, x-build-token",
};

function withCors<T extends Response>(res: T): T {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

// ─── Auth ─────────────────────────────────────────────────
function isAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get("x-jarvis-secret");
  return !!secret && secret === process.env.JARVIS_API_SECRET;
}

// ─── Config ───────────────────────────────────────────────
const GITHUB_REPO = process.env.GITHUB_REPO || "DylanGMurdy/jarvis";
// The dashboard lives in a subdirectory of the repo. Files paths returned by
// Claude are project-root relative (e.g. "src/app/page.tsx"); we prepend this
// subdir so the GitHub API writes to the correct location. Override with
// GITHUB_REPO_SUBDIR="" if the repo root === project root.
const REPO_SUBDIR = process.env.GITHUB_REPO_SUBDIR ?? "jarvis-dashboard";

function repoPath(filePath: string): string {
  // Normalize: strip leading slashes, collapse leading subdir if user already included it
  const clean = filePath.replace(/^\/+/, "");
  if (REPO_SUBDIR && !clean.startsWith(REPO_SUBDIR + "/")) {
    return `${REPO_SUBDIR}/${clean}`;
  }
  return clean;
}

// ─── GitHub helpers ───────────────────────────────────────
interface GhFileMeta { sha: string }

async function getCurrentSha(repoFilePath: string, token: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(repoFilePath).replace(/%2F/g, "/")}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${repoFilePath} failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as GhFileMeta;
  return data.sha;
}

async function putFile(repoFilePath: string, content: string, message: string, token: string): Promise<void> {
  const sha = await getCurrentSha(repoFilePath, token);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(repoFilePath).replace(/%2F/g, "/")}`;
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${repoFilePath} failed: ${res.status} ${await res.text()}`);
}

// ─── Anthropic call ───────────────────────────────────────
interface BuildPlan {
  files: { path: string; content: string }[];
  commitMessage: string;
  summary: string;
}

async function generatePlan(prompt: string, anthropicKey: string): Promise<BuildPlan> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: `You are Claude Code, an expert software engineer working on the Jarvis dashboard codebase (Next.js 16, TypeScript, Tailwind CSS, Supabase).

Respond with ONLY a valid JSON object (no markdown fences, no prose) with this exact structure:
{
  "files": [
    {"path": "src/app/example/page.tsx", "content": "full file content here"}
  ],
  "commitMessage": "feat: short imperative description",
  "summary": "1-2 sentence description of what changed"
}

Rules:
- Each "path" is project-root relative (e.g. "src/app/page.tsx"). Do NOT prefix with "jarvis-dashboard/".
- "content" must be the COMPLETE final file contents (we replace the whole file).
- Never modify package.json, .env.local, next.config.ts, or anything in .git/.
- Use TypeScript and Tailwind. Follow existing patterns.
- Keep changes minimal and focused on the task.

Task:
${prompt}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("No text response from Claude");

  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  const plan = JSON.parse(cleaned) as BuildPlan;
  if (!plan?.files || !Array.isArray(plan.files)) throw new Error("Invalid plan: missing files[]");
  if (!plan.commitMessage) plan.commitMessage = "auto: build";
  if (!plan.summary) plan.summary = "";
  return plan;
}

// ─── POST handler ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!anthropicKey) return withCors(NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 }));
  if (!githubToken) return withCors(NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 }));

  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return withCors(NextResponse.json({ error: "prompt is required" }, { status: 400 }));
    }

    // 1) Ask Claude for a build plan
    const plan = await generatePlan(prompt, anthropicKey);

    // 2) Block sensitive paths
    const blocked = (p: string) => {
      const norm = p.replace(/^\/+/, "");
      return (
        norm === "package.json" ||
        norm === ".env" ||
        norm === ".env.local" ||
        norm === "next.config.ts" ||
        norm.startsWith(".git/")
      );
    };

    const filesChanged: string[] = [];
    const errors: { path: string; error: string }[] = [];

    // 3) PUT each file via GitHub API (sequential to keep parent-tree commits clean)
    for (const file of plan.files) {
      if (!file.path || typeof file.content !== "string") {
        errors.push({ path: file.path || "<missing>", error: "invalid file entry" });
        continue;
      }
      if (blocked(file.path)) {
        errors.push({ path: file.path, error: "blocked path" });
        continue;
      }
      const targetPath = repoPath(file.path);
      try {
        await putFile(targetPath, file.content, plan.commitMessage, githubToken);
        filesChanged.push(targetPath);
      } catch (e: unknown) {
        errors.push({ path: targetPath, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    if (filesChanged.length === 0) {
      return withCors(
        NextResponse.json({ ok: false, error: "No files written", errors, summary: plan.summary }, { status: 500 })
      );
    }

    return withCors(
      NextResponse.json({
        ok: true,
        commitMessage: plan.commitMessage,
        summary: plan.summary,
        filesChanged,
        errors: errors.length > 0 ? errors : undefined,
      })
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/build] error:", msg);
    return withCors(NextResponse.json({ ok: false, error: msg }, { status: 500 }));
  }
}
