import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";

let serverClient: SupabaseClient | null = null;

/** Secret-key (service role) Supabase client. Only ever used inside API route handlers. */
export function getSupabaseAdmin(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Secret key (sb_secret_...) or the legacy service_role key.
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new ApiError(
      500,
      "Server is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY in .env.local, then restart the dev server.",
    );
  }

  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}
