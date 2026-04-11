import { NextRequest, NextResponse } from 'next/server';
import { validateApiSecret, validateBuildToken, unauthorized } from '@/lib/auth';
import { isRateLimited, getRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  if (!validateApiSecret(request) || !validateBuildToken(request)) {
    return unauthorized();
  }
  
  const ip = request.ip || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  try {
    const body = await request.json();
    
    console.log('Build request received:', {
      timestamp: new Date().toISOString(),
      data: body
    });

    // Here you would typically trigger your build process
    // For now, we'll just acknowledge the request
    
    return NextResponse.json({ 
      success: true,
      message: 'Build triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}