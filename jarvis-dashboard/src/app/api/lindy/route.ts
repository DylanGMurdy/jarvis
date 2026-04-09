const LINDY_ENDPOINT = process.env.LINDY_API_ENDPOINT || "";
const LINDY_KEY = process.env.LINDY_API_KEY || "";

function isConfigured(): boolean {
  return (
    LINDY_ENDPOINT !== "" &&
    LINDY_KEY !== "" &&
    !LINDY_ENDPOINT.startsWith("your-") &&
    !LINDY_KEY.startsWith("your-")
  );
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return Response.json({
      response:
        "Lindy is not connected yet. Add LINDY_API_ENDPOINT and LINDY_API_KEY to .env.local to connect your Lindy agent.",
      configured: false,
    });
  }

  try {
    const { message } = await request.json();

    const res = await fetch(LINDY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINDY_KEY}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.log("[Lindy] API error:", res.status, text);
      return Response.json({
        response: `Lindy returned an error (${res.status}). Check your API endpoint and key.`,
        configured: true,
      });
    }

    const data = await res.json();
    // Lindy responses can vary by agent — try common fields
    const reply =
      data.response || data.message || data.text || data.output || JSON.stringify(data);

    return Response.json({ response: reply, configured: true });
  } catch (err) {
    console.log("[Lindy] Exception:", err);
    return Response.json({
      response: "Failed to reach Lindy. Check your endpoint URL.",
      configured: true,
    });
  }
}

export async function GET() {
  return Response.json({ configured: isConfigured() });
}
