import { NextRequest, NextResponse } from 'next/server';
import { validateApiSecret, unauthorized } from '@/lib/auth';
import { isRateLimited, getRateLimitResponse } from '@/lib/rateLimit';

interface Memory {
  id: string;
  timestamp: string;
  type: 'conversation' | 'action' | 'observation';
  content: string;
  metadata?: Record<string, any>;
}

// In-memory storage (replace with actual database)
let memories: Memory[] = [];

export async function GET(request: NextRequest) {
  if (!validateApiSecret(request)) {
    return unauthorized();
  }
  
  const ip = request.ip || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const type = url.searchParams.get('type');

  let filteredMemories = memories;
  if (type) {
    filteredMemories = memories.filter(m => m.type === type);
  }

  const recentMemories = filteredMemories
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return NextResponse.json({ memories: recentMemories });
}

export async function POST(request: NextRequest) {
  if (!validateApiSecret(request)) {
    return unauthorized();
  }
  
  const ip = request.ip || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  try {
    const body = await request.json();
    const { type, content, metadata } = body;

    if (!type || !content) {
      return NextResponse.json({ error: 'Type and content are required' }, { status: 400 });
    }

    const memory: Memory = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      content,
      metadata
    };

    memories.push(memory);

    // Keep only last 1000 memories to prevent memory leaks
    if (memories.length > 1000) {
      memories = memories.slice(-1000);
    }

    return NextResponse.json({ success: true, memory });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}