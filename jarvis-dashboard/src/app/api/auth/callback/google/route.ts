import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/google-auth';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 });

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens to Supabase using upsert
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/google_tokens`, {
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
        expiry_date: tokens.expiry_date || null,
        updated_at: new Date().toISOString()
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase save error:', err);
      // Still redirect even if save fails - tokens are in memory
      return NextResponse.json({ error: 'Token save failed: ' + err }, { status: 500 });
    }

    return NextResponse.redirect(new URL('/?google=connected', req.url));
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
