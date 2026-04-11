import { NextRequest, NextResponse } from 'next/server';
import { validateApiSecret, unauthorized } from '@/lib/auth';
import { isRateLimited, getRateLimitResponse } from '@/lib/rateLimit';

interface Conversation {
  id: string;
  title: string;
  timestamp: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

// In-memory storage (replace with actual database)
let conversations: Conversation[] = [];

export async function GET(request: NextRequest) {
  if (!validateApiSecret(request)) {
    return unauthorized();
  }
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  return NextResponse.json({ conversations });
}

export async function POST(request: NextRequest) {
  if (!validateApiSecret(request)) {
    return unauthorized();
  }
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  try {
    const body = await request.json();
    const { title, messages } = body;

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: title || 'Untitled Conversation',
      timestamp: new Date().toISOString(),
      messages: messages || []
    };

    conversations.push(conversation);

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}