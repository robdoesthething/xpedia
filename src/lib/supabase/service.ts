import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Service-role Supabase client. Bypasses RLS. Singleton per serverless instance. */
export function createServiceClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

export type SupabaseServiceClient = ReturnType<typeof createServiceClient>;
