import { getAccessToken, getStoredRefreshToken } from "@/lib/spotify";

const PLAYER_URL = "https://api.spotify.com/v1/me/player";

export async function PUT(request: Request) {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    return Response.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const { action } = await request.json();
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: "Token refresh failed" }, { status: 401 });
    }

    const actions: Record<string, { url: string; method: string }> = {
      play: { url: `${PLAYER_URL}/play`, method: "PUT" },
      pause: { url: `${PLAYER_URL}/pause`, method: "PUT" },
      next: { url: `${PLAYER_URL}/next`, method: "POST" },
      previous: { url: `${PLAYER_URL}/previous`, method: "POST" },
    };

    const act = actions[action];
    if (!act) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    await fetch(act.url, {
      method: act.method,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
