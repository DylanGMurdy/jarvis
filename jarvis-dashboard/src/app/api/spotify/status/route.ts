import { getStoredRefreshToken, isAppConfigured } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isAppConfigured();
  const refreshToken = await getStoredRefreshToken();
  return Response.json({
    appConfigured: configured,
    connected: !!refreshToken,
  });
}
