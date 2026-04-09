import { getAuthUrl, isAppConfigured } from "@/lib/spotify";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isAppConfigured()) {
    return NextResponse.json(
      { error: "Spotify app not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local" },
      { status: 500 }
    );
  }
  return NextResponse.redirect(getAuthUrl());
}
