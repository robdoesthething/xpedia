import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

export const maxDuration = 60;

/**
 * POST /api/collections/[id]/regenerate
 * Re-extracts and re-synthesizes the AI summary and conclusions for a collection.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(_request)) return csrfForbidden();

  // 5 regenerations per minute per user
  const rl = checkRateLimit(`regenerate:${user.id}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait before regenerating again.');

  // Verify the collection belongs to the user
  const { data: collection } = await supabase
    .from('collections')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!collection) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  // Free tier enforcement: 1 collection, ≤5 tweets
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, ai_collection_id')
    .eq('id', user.id)
    .single();

  const isFree = profile?.plan !== 'pro';

  if (isFree) {
    // If the user already has a different AI collection, block
    if (profile?.ai_collection_id && profile.ai_collection_id !== id) {
      return Response.json(
        { error: 'upgrade_required', reason: 'ai_collection_limit' },
        { status: 403 }
      );
    }

    // Check tweet count in this collection
    const { count } = await supabase
      .from('tweets')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', id)
      .eq('user_id', user.id);

    if ((count ?? 0) > 5) {
      return Response.json(
        { error: 'upgrade_required', reason: 'tweet_count_limit' },
        { status: 403 }
      );
    }

    // First time — record this as the user's free AI slot
    if (!profile?.ai_collection_id) {
      await supabase
        .from('profiles')
        .update({ ai_collection_id: id })
        .eq('id', user.id);
    }
  }

  await regenerateCollectionDocument(id, user.id);

  return Response.json({ success: true });
}
