import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-auth';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { maxResults = 20, query = 'is:unread newer_than:2d' } = await req.json().catch(() => ({}));
    const auth = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const { data } = await gmail.users.messages.list({ userId: 'me', maxResults, q: query });
    const messages = data.messages || [];

    const emails = await Promise.all(messages.slice(0, 15).map(async (msg) => {
      const { data: full } = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'To'] });
      const headers = full.payload?.headers || [];
      const get = (name: string) => headers.find(h => h.name === name)?.value || '';
      return { id: msg.id, subject: get('Subject'), from: get('From'), date: get('Date'), snippet: full.snippet, threadId: full.threadId };
    }));

    return NextResponse.json({ emails, total: messages.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
