import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/google-auth';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20
    });

    const events = (data.items || []).map(e => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      description: e.description?.substring(0, 200),
      attendees: e.attendees?.map(a => a.email)
    }));

    return NextResponse.json({ events, date: now.toDateString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
