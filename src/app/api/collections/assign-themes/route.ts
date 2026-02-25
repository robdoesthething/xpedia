import { createClient } from '@/lib/supabase/server';
import { createServiceClient, type SupabaseServiceClient } from '@/lib/supabase/service';
import { aiRouter } from '@/lib/ai-router';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/collections/assign-themes
 * Assigns AI-generated themes to all collections that have no theme_id.
 * Auth: Cookie-based.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!validateOrigin(request)) return csrfForbidden();

  // 3 assign-theme calls per minute per user
  const rl = checkRateLimit(`assign-themes:${user.id}`, 3, 60_000);
  if (!rl.allowed) {
    return Response.json(
      { error: 'Too many requests. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const service = createServiceClient();

  // Fetch all unthemed collections for this user
  const { data: collections, error: colErr } = await service
    .from('collections')
    .select('id, name')
    .eq('user_id', user.id)
    .is('theme_id', null);

  if (colErr) {
    console.error('[DB] Failed to fetch unthemed collections:', colErr.message);
    return Response.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }

  if (!collections || collections.length === 0) {
    return Response.json({ assigned: 0 });
  }

  // Fetch existing themes to encourage reuse
  const { data: existingThemes } = await service
    .from('themes')
    .select('id, name')
    .eq('user_id', user.id);

  const themeNames = (existingThemes ?? []).map((t: { name: string }) => t.name);
  const themeMap = new Map<string, string>(
    (existingThemes ?? []).map((t: { id: string; name: string }) => [t.name.toLowerCase(), t.id])
  );

  let assigned = 0;

  for (const col of collections) {
    // Use a synthetic minimal tweet representing the collection name
    const result = await aiRouter.categorize(
      {
        content: col.name,
        author_handle: 'system',
      },
      [col.name],
      user.id,
      themeNames
    );

    if (!result) continue;

    // Resolve or create theme
    const themeId = await resolveTheme(service, user.id, result.theme_name, themeMap);
    if (!themeId) continue;

    const { error: updateErr } = await service
      .from('collections')
      .update({ theme_id: themeId })
      .eq('id', col.id)
      .is('theme_id', null);

    if (updateErr) {
      console.error(`[AI] Failed to assign theme to collection ${col.id}:`, updateErr.message);
      continue;
    }

    console.log(`[AI] Collection "${col.name}" → theme "${result.theme_name}"`);
    assigned++;
  }

  return Response.json({ assigned });
}

async function resolveTheme(
  supabase: SupabaseServiceClient,
  userId: string,
  themeName: string,
  themeMap: Map<string, string>
): Promise<string | null> {
  const existing = themeMap.get(themeName.toLowerCase());
  if (existing) return existing;

  const { data, error } = await supabase
    .from('themes')
    .insert({ user_id: userId, name: themeName })
    .select('id')
    .single();

  if (error) {
    const { data: fallback } = await supabase
      .from('themes')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', themeName)
      .single();

    if (fallback) {
      themeMap.set(themeName.toLowerCase(), fallback.id);
      return fallback.id;
    }

    console.error(`[AI] Failed to create theme "${themeName}":`, error.message);
    return null;
  }

  themeMap.set(themeName.toLowerCase(), data.id);
  return data.id;
}
