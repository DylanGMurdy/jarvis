import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-auth';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { query = '', maxResults = 20 } = await req.json().catch(() => ({}));
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const { data } = await drive.files.list({
      q: query ? `name contains '${query}' and trashed=false` : 'trashed=false',
      pageSize: maxResults,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      orderBy: 'modifiedTime desc'
    });

    return NextResponse.json({ files: data.files || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
