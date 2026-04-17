import { google } from 'googleapis';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function supabaseRequest(path: string, method: string, body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return res.json().catch(() => ({}));
}

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
  await supabaseRequest('/google_tokens?on_conflict=user_id', 'POST', {
    user_id: 'dylan',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expiry_date: tokens.expiry_date || null,
    updated_at: new Date().toISOString()
  });
}

export async function getTokens() {
  const data = await supabaseRequest('/google_tokens?user_id=eq.dylan', 'GET');
  return Array.isArray(data) ? data[0] : null;
}

export async function getAuthenticatedClient() {
  const oauth2Client = getOAuthClient();
  const tokens = await getTokens();
  if (!tokens) throw new Error('No Google tokens — visit /api/auth/google to connect');
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
