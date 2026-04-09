import { exchangeCode, isAppConfigured, COOKIE_NAME } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!isAppConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify=error", request.url));
  }

  try {
    const data = await exchangeCode(code);

    if (!data.refresh_token) {
      console.log("[Spotify callback] No refresh token in response");
      return NextResponse.redirect(new URL("/?spotify=error", request.url));
    }

    // Set cookie directly on the redirect response — this is the only
    // reliable way in Next.js App Router route handlers
    const response = NextResponse.redirect(
      new URL("/?spotify=connected", request.url)
    );
    response.cookies.set(COOKIE_NAME, data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    console.log("[Spotify callback] Cookie set on redirect response");
    return response;
  } catch (err) {
    console.log("[Spotify callback] Exception:", err);
    return NextResponse.redirect(new URL("/?spotify=error", request.url));
  }
}
