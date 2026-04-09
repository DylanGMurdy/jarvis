import { cookies } from "next/headers";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const COOKIE_NAME = "jarvis_spotify_refresh";

export const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
].join(" ");

export function isAppConfigured(): boolean {
  return (
    CLIENT_ID !== "" &&
    CLIENT_SECRET !== "" &&
    REDIRECT_URI !== "" &&
    !CLIENT_ID.startsWith("your-") &&
    !CLIENT_SECRET.startsWith("your-")
  );
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function getBasicAuth(): string {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode(
  code: string
): Promise<{ access_token: string; refresh_token: string }> {
  console.log("[Spotify] Exchanging code, redirect_uri:", REDIRECT_URI);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  console.log("[Spotify] Exchange response:", {
    has_access_token: !!data.access_token,
    has_refresh_token: !!data.refresh_token,
    error: data.error,
  });
  return data;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return res.json();
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function getAccessToken(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  const data = await refreshAccessToken(refreshToken);
  if (!data.access_token) {
    console.log("[Spotify] Failed to refresh access token");
    return null;
  }

  return data.access_token;
}
