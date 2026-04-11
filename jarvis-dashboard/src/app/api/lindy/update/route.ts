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
    const body = await request.json();
    
    // Log the Lindy update
    console.log('Lindy update received:', {
      timestamp: new Date().toISOString(),
      data: body
    });

    return NextResponse.json({ 
      success: true,
      message: 'Update received',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}