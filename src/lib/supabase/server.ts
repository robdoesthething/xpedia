import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from a Server Component where cookies
            // cannot be set. This can be safely ignored when the middleware
            // is refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Validates the cookie-based session and returns the authenticated user
 * alongside the Supabase client. Returns null if unauthenticated.
 *
 * Usage:
 *   const auth = await requireUser();
 *   if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   const { user, supabase } = auth;
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}
