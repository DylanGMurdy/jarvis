import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 });

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      console.error('Token exchange error:', tokens);
      return NextResponse.json({ error: tokens.error, description: tokens.error_description }, { status: 400 });
    }

    // Save to Supabase
    const saveRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/google_tokens`, {
      method: 'POST',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        user_id: 'dylan',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expiry_date: Date.now() + (tokens.expires_in * 1000),
        updated_at: new Date().toISOString()
      })
    });

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return NextResponse.json({ error: 'Save failed', details: err }, { status: 500 });
    }

    return NextResponse.redirect(new URL('/?google=connected', req.url));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
