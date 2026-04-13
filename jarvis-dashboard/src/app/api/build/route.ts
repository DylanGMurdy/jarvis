// api-build-test
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Get current codebase context
    const projectRoot = process.cwd()
    const srcPath = path.join(projectRoot, 'src')
    
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
      } catch (error) {
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
        model: 'claude-3-5-sonnet-20241022',
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
    const results = []
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
    } catch (buildError: any) {
      return NextResponse.json({ 
        error: 'Build failed', 
        details: buildError.message,
        files: results
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      summary: buildPlan.summary,
      files: results
    })

  } catch (error: any) {
    console.error('Build API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}