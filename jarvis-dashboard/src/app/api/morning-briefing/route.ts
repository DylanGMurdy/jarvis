import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client = new Anthropic();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const { data: projects } = await supabase.from('projects').select('title,status,grade').order('created_at',{ascending:false}).limit(5);
    const { data: approvals } = await supabase.from('approval_queue').select('*').eq('status','pending').limit(5);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are Jarvis, Dylan Murdock's AI chief of staff. Dylan is a real estate agent at Narwhal Homes in Utah also building AI businesses. Generate his morning briefing as JSON:
{"date":"${dateStr}","greeting":"personalized good morning","email_summary":"2-3 sentences on inbox","urgent_emails":[{"from":"","subject":"","action":""}],"top_priorities":["p1","p2","p3"],"business_update":"brief Jarvis/LoanPilot update","pending_approvals":${approvals?.length||0},"active_projects":${projects?.length||0}}`,
      messages: [{ role: 'user', content: `Check my Gmail for unread emails from last 24 hours then generate my morning briefing for ${dateStr}. Return only valid JSON.` }],
      mcp_servers: [{ type: 'url' as any, url: 'https://gmailmcp.googleapis.com/mcp/v1', name: 'gmail' }]
    });

    const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const briefing = JSON.parse(text.replace(/```json|```/g, '').trim());
    await supabase.from('notifications').insert({ title: `Morning Briefing — ${dateStr}`, body: briefing.greeting, type: 'briefing', read: false, created_at: new Date().toISOString() });
    return NextResponse.json(briefing);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
