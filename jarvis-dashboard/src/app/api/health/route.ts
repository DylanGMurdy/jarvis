export async function GET() {
  return Response.json({
    ok: true,
    version: "1.0",
    agents: 21,
    timestamp: new Date().toISOString(),
  });
}
