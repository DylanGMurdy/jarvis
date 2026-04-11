import { NextRequest, NextResponse } from 'next/server';
import { validateApiSecret, unauthorized } from '@/lib/auth';
import { isRateLimited, getRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  if (!validateApiSecret(request)) {
    return unauthorized();
  }
  
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Simple echo response for now
    const response = {
      message: `I received: ${message}`,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}