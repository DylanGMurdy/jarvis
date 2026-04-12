// GET — return connection status of all integrations based on env vars
export async function GET() {
  const status = {
    anthropic: !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("your-")),
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-")),
    google_drive: !!(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes("your-")),
    perplexity: !!(process.env.PERPLEXITY_API_KEY && !process.env.PERPLEXITY_API_KEY.includes("your-")),
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.includes("your-")),
    gmail: !!(process.env.GMAIL_CLIENT_ID && !process.env.GMAIL_CLIENT_ID.includes("your-")),
  };
  return Response.json({ status });
}
