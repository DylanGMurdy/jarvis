import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getRateLimitIdentifier } from './lib/rateLimit'

const publicRoutes = ['/login', '/landing', '/api/auth/login', '/api/lindy/update', '/api/build', '/api/build/status', '/api/waitlist']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    const identifier = getRateLimitIdentifier(request)
    const rateLimitResult = rateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 100
    })

    if (!rateLimitResult.success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          resetTime: rateLimitResult.resetTime
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      )
    }
  }

  // Check session cookie
  const sessionCookie = request.cookies.get('jarvis_session')
  const isValidSession = sessionCookie?.value === process.env.JARVIS_PASSWORD

  if (!isValidSession) {
    // For API routes, return 401 JSON
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For regular routes, redirect to login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
