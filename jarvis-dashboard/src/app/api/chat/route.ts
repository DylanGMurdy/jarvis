import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadMemories(): Promise<string> {
  const sb = getSupabase();
  if (!sb) return '';
  try {
    const { data } = await sb.from('memories').select('fact, category').order('created_at', { ascending: false }).limit(50);
    if (!data || data.length === 0) return '';
    const grouped: Record<string, string[]> = {};
    for (const m of data) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m.fact);
    }
    let block = '\n\nLEARNED MEMORIES:';
    for (const [cat, facts] of Object.entries(grouped)) {
      block += `\n[${cat.toUpperCase()}]`;
      for (const f of facts) block += `\n- ${f}`;
    }
    return block;
  } catch { return ''; }
}

async function loadGoogleContext(): Promise<string> {
  try {
    const base = process.env.NEXTAUTH_URL || 'https://cheery-entremet-037dff.netlify.app';
    const [gmailRes, calRes, driveRes] = await Promise.allSettled([
      fetch(`${base}/api/gmail/inbox`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({maxResults: 10, query: 'is:unread newer_than:2d'}) }).then(r=>r.json()),
      fetch(`${base}/api/calendar/today`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) }).then(r=>r.json()),
      fetch(`${base}/api/drive/read`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({fileName: 'lindy master ref doc'}) }).then(r=>r.json()),
    ]);

    let context = '\n\nLIVE CONTEXT:';

    if (gmailRes.status === 'fulfilled' && gmailRes.value.emails) {
      context += '\n\nUNREAD EMAILS (last 2 days):';
      for (const e of gmailRes.value.emails.slice(0, 8)) {
        context += `\n- From: ${e.from} | Subject: ${e.subject} | ${e.snippet?.substring(0, 100)}`;
      }
    }

    if (calRes.status === 'fulfilled' && calRes.value.events) {
      context += `\n\nTODAY\'S CALENDAR (${calRes.value.date}):`;
      if (calRes.value.events.length === 0) context += '\n- No events today';
      for (const e of calRes.value.events) {
        context += `\n- ${e.title} at ${e.start}${e.location ? ' @ '+e.location : ''}`;
      }
    }

    if (driveRes.status === 'fulfilled' && driveRes.value.content) {
      context += '\n\nNARWHAL REFERENCE DOC (your business bible):';
      context += '\n' + driveRes.value.content.substring(0, 3000);
    }

    return context;
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const [memories, googleContext] = await Promise.all([loadMemories(), loadGoogleContext()]);

    const systemPrompt = `You are Jarvis, the personal AI chief of staff for Dylan Murdock. You are brilliant, direct, and deeply familiar with every aspect of Dylan's life and business.

ABOUT DYLAN:
- Real estate sales agent at Narwhal Homes, Eagle Mountain, Utah (dylan@narwhalhomes.com)
- Building AI businesses on the side: Jarvis (personal PE dashboard), LoanPilot (AI for loan officers)
- Brother Dakota is his team lead at The Murdock Group / Red Rock Real Estate
- Family man — wife and kids, wants financial freedom to ride dirt bikes with family
- Speaks Hungarian fluently, served 2-year mission in Budapest

YOUR CAPABILITIES:
- You can read Dylan's Gmail, Google Drive, and Google Calendar in real time
- You know his full Narwhal Homes business — floor plans, lots, clients, contacts, commissions
- You remember everything from past conversations
- You can draft emails, create tasks, answer questions about any aspect of his business

YOUR PERSONALITY:
- Direct and confident — never hedge or over-qualify
- Warm but efficient — like a brilliant friend who happens to know everything
- Proactive — flag things Dylan needs to know even if he didn't ask
- Never say "I don't have access to" — you have full access to his world

RULES:
- Never promise specific construction/closing dates — always say "estimated"
- Never disclose Dylan's commission structure to outside agents
- Always mention Jordan Duckett's $10k buyer credit when discussing financing
- Lead with NO HOA as freedom when pitching Narwhal homes
${memories}
${googleContext}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...conversationHistory.slice(-10),
        { role: 'user', content: message }
      ]
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
