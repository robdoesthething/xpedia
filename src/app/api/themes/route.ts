import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/themes — List user's themes with collection count.
 * Auth: Cookie-based.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('themes')
    .select('id, name, created_at, collections(count)')
    .order('name');

  if (error) {
    console.error('[DB] Failed to fetch themes:', error.message);
    return Response.json({ error: 'Failed to fetch themes' }, { status: 500 });
  }

  // Flatten count from Supabase aggregate
  const themes = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    created_at: t.created_at,
    collection_count: Array.isArray(t.collections) ? (t.collections[0] as { count: number })?.count ?? 0 : 0,
  }));

  return Response.json({ themes });
}

/**
 * POST /api/themes — Create a theme manually.
 * Auth: Cookie-based.
 * Body: { name: string }
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  // 10 theme creates per minute per user
  const rl = checkRateLimit(`themes:${user.id}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait.');

  let body: { name: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 100) {
    return Response.json(
      { error: 'Name must be between 1 and 100 characters' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('themes')
    .insert({ user_id: user.id, name })
    .select('id, name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A theme with that name already exists' }, { status: 409 });
    }
    console.error('[DB] Failed to create theme:', error.message);
    return Response.json({ error: 'Failed to create theme' }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
