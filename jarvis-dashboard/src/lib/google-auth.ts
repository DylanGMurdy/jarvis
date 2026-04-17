import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ]
  });
}

export async function saveTokens(tokens: any) {
  await supabase.from('google_tokens').upsert({
    user_id: 'dylan',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    updated_at: new Date().toISOString()
  });
}

export async function getTokens() {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', 'dylan').single();
  return data;
}

export async function getAuthenticatedClient() {
  const oauth2Client = getOAuthClient();
  const tokens = await getTokens();
  if (!tokens) throw new Error('No Google tokens found — please authenticate first at /api/auth/google');
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  });
  oauth2Client.on('tokens', async (newTokens) => {
    await saveTokens({ ...tokens, ...newTokens });
  });
  return oauth2Client;
}
