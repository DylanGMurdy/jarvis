import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-auth';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { fileId, fileName } = await req.json();
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    // If no fileId, search by name
    let id = fileId;
    if (!id && fileName) {
      const { data } = await drive.files.list({ q: `name contains '${fileName}' and trashed=false`, pageSize: 1, fields: 'files(id,name,mimeType)' });
      id = data.files?.[0]?.id;
    }
    if (!id) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // Export as plain text
    const { data } = await drive.files.export({ fileId: id, mimeType: 'text/plain' }, { responseType: 'text' });
    return NextResponse.json({ content: data, fileId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
