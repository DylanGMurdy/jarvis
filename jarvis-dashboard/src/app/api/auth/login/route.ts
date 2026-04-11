import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const ip = request.ip || 'unknown';
  if (isRateLimited(ip)) {
    return getRateLimitResponse();
  }

  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (password !== process.env.JARVIS_PASSWORD) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    
    // Set httpOnly cookie that expires in 30 days
    response.cookies.set('jarvis_session', process.env.JARVIS_PASSWORD, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/'
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}