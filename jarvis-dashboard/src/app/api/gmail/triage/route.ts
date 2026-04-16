import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are Jarvis, Dylan Murdock's AI chief of staff. You have access to his Gmail at dylan@narwhalhomes.com. Triage his unread emails from the last 2 days. Return ONLY valid JSON:
{"triaged_at":"ISO timestamp","summary":"2-3 sentence overview","urgent":[{"from":"","subject":"","snippet":"","action":"","thread_id":""}],"follow_up":[{"from":"","subject":"","snippet":"","action":"","thread_id":""}],"fyi":[{"from":"","subject":"","snippet":""}],"stats":{"total":0,"urgent":0,"follow_up":0,"fyi":0}}`,
      messages: [{ role: 'user', content: 'Search my Gmail for unread emails from the last 2 days and triage them. Return only the JSON.' }],
      mcp_servers: [{ type: 'url' as any, url: 'https://gmailmcp.googleapis.com/mcp/v1', name: 'gmail' }]
    });
    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const triage = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json(triage);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
