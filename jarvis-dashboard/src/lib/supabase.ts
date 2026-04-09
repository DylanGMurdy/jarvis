import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _serviceClient: SupabaseClient | null = null;

// Standard client using anon key — for general use
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("your-supabase") || key.includes("your_service")) {
    return null;
  }
  _client = createClient(url, key);
  return _client;
}

// Service role client — bypasses RLS, use only in server API routes
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_serviceClient) return _serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.includes("your_service")) {
    // Fall back to anon key
    return getSupabase();
  }
  _serviceClient = createClient(url, key);
  return _serviceClient;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
