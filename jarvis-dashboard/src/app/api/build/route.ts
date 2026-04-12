import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret, validateBuildToken, unauthorized } from "@/lib/auth";
import { isRateLimited, getRateLimitResponse } from "@/lib/rateLimit";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { execSync } from "child_process";

const BUILD_LOG_PATH = join(process.cwd(), ".build-log.json");

// ─── CORS headers (apply to every response from this route) ──
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-jarvis-secret, x-build-token",
};

function withCors(res: Response): Response {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

// ─── Verify env vars at module load (logs first 10 chars only) ──
{
  const secret = process.env.JARVIS_API_SECRET;
  const token = process.env.JARVIS_BUILD_TOKEN;
  console.log(
    `[api/build] JARVIS_API_SECRET: ${secret ? secret.slice(0, 10) + "..." : "MISSING"}`
  );
  console.log(
    `[api/build] JARVIS_BUILD_TOKEN: ${token ? token.slice(0, 10) + "..." : "MISSING"}`
  );
}

// ─── OPTIONS handler for CORS preflight ──────────────────────
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

const SYSTEM_PROMPT = `You are Claude Code, an expert software engineer working on the Jarvis dashboard codebase. This is a Next.js 16 app with TypeScript, Tailwind CSS, and Supabase.

When given a build prompt, respond with ONLY a valid JSON object (no markdown fences, no explanation) with this exact structure:
{
  "files": [
    {
      "path": "src/app/example/page.tsx",
      "action": "create" | "modify",
      "content": "full file content here"
    }
  ],
  "summary": "short description of what was changed"
}

Rules:
- All file paths are relative to the project root
- For "modify" actions, provide the COMPLETE new file content
- For "create" actions, provide the full file content
- Use TypeScript, Tailwind CSS, and follow existing patterns in the codebase
- Never modify package.json, .env.local, or next.config.ts
- Never delete files
- Keep changes minimal and focused on the prompt`;

interface FileChange {
  path: string;
  action: "create" | "modify";
  content: string;
}

interface BuildResponse {
  files: FileChange[];
  summary: string;
}

interface BuildLogEntry {
  id: string;
  prompt: string;
  summary: string;
  status: "success" | "error";
  filesChanged: string[];
  commitHash: string | null;
  error?: string;
  timestamp: string;
}

function loadBuildLog(): BuildLogEntry[] {
  try {
    if (existsSync(BUILD_LOG_PATH)) {
      return JSON.parse(readFileSync(BUILD_LOG_PATH, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveBuildLog(entries: BuildLogEntry[]) {
  writeFileSync(BUILD_LOG_PATH, JSON.stringify(entries, null, 2));
}

function addBuildLogEntry(entry: BuildLogEntry) {
  const log = loadBuildLog();
  log.unshift(entry);
  saveBuildLog(log.slice(0, 50));
}

export async function POST(request: NextRequest) {
  if (!validateApiSecret(request) || !validateBuildToken(request)) {
    return withCors(unauthorized());
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) {
    return withCors(getRateLimitResponse());
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return withCors(
      NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      )
    );
  }

  const buildId = crypto.randomUUID();
  let prompt = "";

  try {
    const body = await request.json();
    prompt = body.prompt;
    const context = body.context || "";

    if (!prompt || typeof prompt !== "string") {
      return withCors(
        NextResponse.json(
          { ok: false, error: "prompt is required" },
          { status: 400 }
        )
      );
    }

    // Build the user message with optional context
    let userMessage = prompt;
    if (context) {
      userMessage = `Context:\n${context}\n\nTask:\n${prompt}`;
    }

    // Call Claude to generate the code changes
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response
    const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
    const buildResponse: BuildResponse = JSON.parse(cleaned);

    if (!buildResponse.files || !Array.isArray(buildResponse.files)) {
      throw new Error("Invalid response: missing files array");
    }

    const projectRoot = process.cwd();
    const filesChanged: string[] = [];

    // Apply file changes
    for (const file of buildResponse.files) {
      // Security: prevent path traversal
      const fullPath = resolve(projectRoot, file.path);
      if (!fullPath.startsWith(projectRoot)) {
        throw new Error(`Path traversal blocked: ${file.path}`);
      }

      // Don't allow modifying sensitive files
      const blocked = [
        ".env",
        ".env.local",
        "package.json",
        "next.config.ts",
        ".git",
      ];
      if (
        blocked.some(
          (b) => file.path === b || file.path.startsWith(".git/")
        )
      ) {
        throw new Error(`Blocked file: ${file.path}`);
      }

      // Ensure directory exists
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(fullPath, file.content, "utf-8");
      filesChanged.push(file.path);
    }

    // Generate a short commit summary from the prompt
    const commitSummary =
      prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;

    // Git add, commit, push
    const gitCommands = [
      "git add .",
      `git commit -m "auto: ${commitSummary.replace(/"/g, '\\"')}"`,
      "git push",
    ];

    let commitHash = "";
    for (const cmd of gitCommands) {
      const output = execSync(cmd, {
        cwd: projectRoot,
        encoding: "utf-8",
        timeout: 30000,
      });
      if (cmd.startsWith("git commit")) {
        const match = output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
        if (match) commitHash = match[1];
      }
    }

    // Log success
    addBuildLogEntry({
      id: buildId,
      prompt,
      summary: buildResponse.summary,
      status: "success",
      filesChanged,
      commitHash,
      timestamp: new Date().toISOString(),
    });

    return withCors(
      NextResponse.json({
        ok: true,
        id: buildId,
        summary: buildResponse.summary,
        filesChanged,
        commitHash,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    addBuildLogEntry({
      id: buildId,
      prompt,
      summary: "",
      status: "error",
      filesChanged: [],
      commitHash: null,
      error: message,
      timestamp: new Date().toISOString(),
    });

    return withCors(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
