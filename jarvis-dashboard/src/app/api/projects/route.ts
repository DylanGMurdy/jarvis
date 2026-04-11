import { NextRequest, NextResponse } from 'next/server';
import { validateApiSecret, unauthorized } from '@/lib/auth';
import { isRateLimited, getRateLimitResponse } from '@/lib/rateLimit';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: string;
  updatedAt: string;
}

// In-memory storage (replace with actual database)
let projects: Project[] = [
  {
    id: '1',
    name: 'Jarvis Dashboard',
    description: 'AI-powered dashboard for managing tasks and conversations',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  }
];

export async function GET(request: NextRequest) {
  if (!validateApiSecret(request)) {
    return unauthorized();
  }
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  return NextResponse.json({ projects });
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
    const { name, description, status = 'active' } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    projects.push(project);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}