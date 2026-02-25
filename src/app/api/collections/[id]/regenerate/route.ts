import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  await regenerateCollectionDocument(id, user.id);

  return Response.json({ success: true });
}
