import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';

/**
 * PATCH /api/tweets/[id] — Move a tweet to a different collection.
 * Auth: Cookie-based.
 * Body: { collection_id: string | null }
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

  let body: { collection_id: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!('collection_id' in body)) {
    return Response.json({ error: 'collection_id is required' }, { status: 400 });
  }

  // Fetch the tweet to get the current collection_id (needed for regeneration)
  const { data: tweet, error: fetchErr } = await supabase
    .from('tweets')
    .select('id, collection_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !tweet) {
    return Response.json({ error: 'Tweet not found' }, { status: 404 });
  }

  const oldCollectionId = tweet.collection_id as string | null;

  // No-op if moving to the same collection
  if (oldCollectionId === body.collection_id) {
    return Response.json({ success: true });
  }

  // If assigning to a collection, verify it belongs to the user
  if (body.collection_id !== null) {
    const { data: collection, error: colErr } = await supabase
      .from('collections')
      .select('id')
      .eq('id', body.collection_id)
      .eq('user_id', user.id)
      .single();

    if (colErr || !collection) {
      return Response.json({ error: 'Collection not found' }, { status: 404 });
    }
  }

  const { error: updateErr } = await supabase
    .from('tweets')
    .update({ collection_id: body.collection_id })
    .eq('id', id);

  if (updateErr) {
    console.error('[DB] Failed to move tweet:', updateErr.message);
    return Response.json({ error: 'Failed to move tweet' }, { status: 500 });
  }

  // Use after() so regeneration runs after the response is sent but before
  // the serverless function exits
  const collectionsToRegenerate: string[] = [];
  if (oldCollectionId) collectionsToRegenerate.push(oldCollectionId);
  if (body.collection_id) collectionsToRegenerate.push(body.collection_id);
  const userId = user.id;

  if (collectionsToRegenerate.length > 0) {
    after(async () => {
      await Promise.allSettled(
        collectionsToRegenerate.map((colId) =>
          regenerateCollectionDocument(colId, userId)
        )
      );
    });
  }

  return Response.json({ success: true });
}
