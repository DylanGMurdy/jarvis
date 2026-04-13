// api-build-test
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

// ─── CORS headers (apply to every response) ──
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-jarvis-secret, x-build-token',
}

function withCors<T extends Response>(res: T): T {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

// ─── Auth: require matching x-jarvis-secret header ──
function isAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get('x-jarvis-secret')
  return !!secret && secret === process.env.JARVIS_API_SECRET
}

// ─── OPTIONS handler for CORS preflight ──
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  // Auth gate
  if (!isAuthorized(request)) {
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return withCors(NextResponse.json({ error: 'Prompt is required' }, { status: 400 }))
    }

    // Get current codebase context
    const projectRoot = process.cwd()

    // Read key files for context
    const contextFiles = [
      'src/app/layout.tsx',
      'src/app/page.tsx',
      'package.json'
    ]

    let context = 'Current codebase structure:\n\n'
    for (const file of contextFiles) {
      try {
        const content = await fs.readFile(path.join(projectRoot, file), 'utf-8')
        context += `${file}:\n${content}\n\n`
      } catch {
        // File doesn't exist, skip
      }
    }

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are Claude Code, an expert software engineer working on the Jarvis dashboard codebase. This is a Next.js 16 app with TypeScript, Tailwind CSS, and Supabase.

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
- Keep changes minimal and focused on the prompt

Context:\n${context}\n\nTask:\n${prompt}`
        }]
      })
    })

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`)
    }

    const claudeData = await claudeResponse.json()
    const buildPlan = JSON.parse(claudeData.content[0].text)

    // Execute the build plan
    const results: { path: string; action: string; status: string }[] = []
    for (const file of buildPlan.files) {
      const filePath = path.join(projectRoot, file.path)
      const dir = path.dirname(filePath)

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })

      // Write file
      await fs.writeFile(filePath, file.content, 'utf-8')

      results.push({
        path: file.path,
        action: file.action,
        status: 'success'
      })
    }

    // Run build to check for errors
    try {
      const { stdout, stderr } = await execAsync('npm run build')
      console.log('Build output:', stdout)
      if (stderr) console.log('Build stderr:', stderr)
    } catch (buildError: unknown) {
      const msg = buildError instanceof Error ? buildError.message : 'Unknown build error'
      return withCors(NextResponse.json({
        error: 'Build failed',
        details: msg,
        files: results
      }, { status: 500 }))
    }

    return withCors(NextResponse.json({
      success: true,
      summary: buildPlan.summary,
      files: results
    }))

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Build API error:', msg)
    return withCors(NextResponse.json({
      error: 'Internal server error',
      details: msg
    }, { status: 500 }))
  }
}
