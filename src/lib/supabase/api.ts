import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client authenticated with a Bearer token.
 * Used by API routes that receive tokens from the Chrome extension
 * (which can't use cookie-based auth).
 */
export function createClientFromToken(token: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}
