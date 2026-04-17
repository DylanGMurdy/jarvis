import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient, saveTokens } from '@/lib/google-auth';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(tokens);
    return NextResponse.redirect(new URL('/?google=connected', req.url));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
