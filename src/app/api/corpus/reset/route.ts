import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

/**
 * POST /api/corpus/reset
 * Wipes all themes and collections for the authenticated user.
 * Tweets are kept but become uncategorized (collection_id = null).
 * Resets onboarding_completed so the interest picker shows again.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  // 1. Uncategorize all tweets (collection_id → null)
  await supabase
    .from('tweets')
    .update({ collection_id: null })
    .eq('user_id', user.id);

  // 2. Delete all collections
  await supabase
    .from('collections')
    .delete()
    .eq('user_id', user.id);

  // 3. Delete all themes
  await supabase
    .from('themes')
    .delete()
    .eq('user_id', user.id);

  // 4. Reset onboarding state and free AI slot
  await supabase
    .from('profiles')
    .update({ onboarding_completed: false, ai_collection_id: null })
    .eq('id', user.id);

  return Response.json({ ok: true });
}
