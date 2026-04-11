import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Test endpoint that demonstrates missing auth header vulnerability
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No authorization header provided', vulnerable: true },
      { status: 401 }
    );
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Invalid authorization header format', vulnerable: true },
      { status: 401 }
    );
  }
  
  const token = authHeader.substring(7);
  
  if (!token || token.length === 0) {
    return NextResponse.json(
      { error: 'Empty token provided', vulnerable: true },
      { status: 401 }
    );
  }
  
  // In a real app, validate the token here
  // For testing purposes, accept any non-empty token
  return NextResponse.json(
    { 
      message: 'Access granted',
      token: token.substring(0, 10) + '...', // Only show first 10 chars for security
      vulnerable: false
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authentication required for POST requests', vulnerable: true },
      { status: 403 }
    );
  }
  
  try {
    const body = await request.json();
    return NextResponse.json(
      { message: 'POST request successful', data: body },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
}