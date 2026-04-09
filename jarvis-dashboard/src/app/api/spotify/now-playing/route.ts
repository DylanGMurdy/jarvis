import { getAccessToken, getStoredRefreshToken, isAppConfigured } from "@/lib/spotify";

const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAppConfigured()) {
    return Response.json({ isPlaying: false, connected: false, appNotConfigured: true });
  }

  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    return Response.json({ isPlaying: false, connected: false });
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ isPlaying: false, connected: false });
    }

    const res = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.status > 400) {
      return Response.json({ isPlaying: false, connected: true });
    }

    const data = await res.json();
    if (!data.item) {
      return Response.json({ isPlaying: false, connected: true });
    }

    return Response.json({
      isPlaying: data.is_playing,
      connected: true,
      title: data.item.name,
      artist: data.item.artists.map((a: { name: string }) => a.name).join(", "),
      album: data.item.album.name,
      albumArt: data.item.album.images[0]?.url || "",
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
    });
  } catch {
    return Response.json({ isPlaying: false, connected: true });
  }
}
