import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

/**
 * GET /api/themes/[id] — Theme detail with collections and digests.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  const [themeRes, collectionsRes, digestsRes] = await Promise.all([
    supabase.from('themes').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('collections').select('*, themes(id, name, created_at, updated_at)')
      .eq('theme_id', id).eq('user_id', user.id).order('name'),
    supabase.from('theme_digests').select('*')
      .eq('theme_id', id).eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
  ]);

  if (themeRes.error) {
    if (themeRes.error.code === 'PGRST116') return Response.json({ error: 'Not found' }, { status: 404 });
    console.error('[DB] Failed to fetch theme:', themeRes.error.message);
    return Response.json({ error: 'Failed to fetch theme' }, { status: 500 });
  }
  if (!themeRes.data) return Response.json({ error: 'Not found' }, { status: 404 });

  if (collectionsRes.error) console.error('[DB] Failed to fetch theme collections:', collectionsRes.error.message);
  if (digestsRes.error) console.error('[DB] Failed to fetch theme digests:', digestsRes.error.message);

  return Response.json({
    theme: themeRes.data,
    collections: collectionsRes.data ?? [],
    digests: digestsRes.data ?? [],
  });
}

/**
 * PATCH /api/themes/[id] — Rename a theme.
 * Body: { name: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  let body: { name?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 100) {
    return Response.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('themes').update({ name }).eq('id', id).eq('user_id', user.id)
    .select('id, name').single();

  if (error) {
    if (error.code === '23505') return Response.json({ error: 'A theme with that name already exists' }, { status: 409 });
    if (error.code === 'PGRST116') return Response.json({ error: 'Theme not found' }, { status: 404 });
    console.error('[DB] Failed to rename theme:', error.message);
    return Response.json({ error: 'Failed to rename theme' }, { status: 500 });
  }
  if (!data) return Response.json({ error: 'Theme not found' }, { status: 404 });

  return Response.json(data);
}

/**
 * DELETE /api/themes/[id] — Delete a theme.
 * Query params:
 *   orphan_action: 'uncategorize' | 'delete_collections'
 *     uncategorize   — keep collections but remove their theme (default DB behaviour)
 *     delete_collections — delete all collections in this theme (tweets → uncategorized)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  const url = new URL(request.url);
  const orphanAction = url.searchParams.get('orphan_action');

  if (orphanAction !== 'uncategorize' && orphanAction !== 'delete_collections') {
    return Response.json(
      { error: 'orphan_action must be "uncategorize" or "delete_collections"' },
      { status: 400 }
    );
  }

  // Verify theme belongs to user
  const { data: theme, error: fetchError } = await supabase
    .from('themes')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !theme) {
    return Response.json({ error: 'Theme not found' }, { status: 404 });
  }

  if (orphanAction === 'delete_collections') {
    // Fetch all collections in this theme
    const { data: collections } = await supabase
      .from('collections')
      .select('id')
      .eq('theme_id', id)
      .eq('user_id', user.id);

    if (collections && collections.length > 0) {
      const ids = collections.map((c) => c.id);

      // Uncategorize tweets in those collections
      await supabase
        .from('tweets')
        .update({ collection_id: null })
        .in('collection_id', ids)
        .eq('user_id', user.id);

      // Clear free AI slot if one of these collections was it
      await supabase
        .from('profiles')
        .update({ ai_collection_id: null })
        .in('ai_collection_id', ids)
        .eq('id', user.id);

      // Delete the collections
      await supabase
        .from('collections')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);
    }
  }
  // For 'uncategorize', the DB FK (ON DELETE SET NULL) handles it automatically.

  const { error } = await supabase
    .from('themes').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    console.error('[DB] Failed to delete theme:', error.message);
    return Response.json({ error: 'Failed to delete theme' }, { status: 500 });
  }

  return Response.json({ success: true });
}
