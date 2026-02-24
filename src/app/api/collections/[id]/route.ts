import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

/**
 * PATCH /api/collections/[id] — Update a collection's name or type.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!validateOrigin(request)) return csrfForbidden();

  let body: { name?: string; type?: string; theme_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 100) {
      return Response.json({ error: 'Name must be between 1 and 100 characters' }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.type !== undefined) {
    if (body.type !== 'topic' && body.type !== 'project') {
      return Response.json({ error: 'Type must be "topic" or "project"' }, { status: 400 });
    }
    updates.type = body.type;
  }

  if ('theme_id' in body) {
    updates.theme_id = body.theme_id ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('collections')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, name, type')
    .single();

  if (error || !data) {
    console.error('[DB] Failed to update collection:', error?.message);
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  return Response.json(data);
}

/**
 * DELETE /api/collections/[id] — Delete a collection.
 * Tweets in this collection become uncategorized (DB ON DELETE SET NULL).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!validateOrigin(_request)) return csrfForbidden();

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[DB] Failed to delete collection:', error.message);
    return Response.json({ error: 'Failed to delete collection' }, { status: 500 });
  }

  return Response.json({ success: true });
}
