import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/api/auth/login', '/api/lindy/update'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }
  
  // Check session cookie
  const sessionCookie = request.cookies.get('jarvis_session');
  const isValidSession = sessionCookie?.value === process.env.JARVIS_PASSWORD;
  
  if (!isValidSession) {
    // For API routes, return 401 JSON
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // For regular routes, redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};