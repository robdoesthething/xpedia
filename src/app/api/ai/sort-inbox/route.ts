import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { categorizeTweetBatch } from '@/lib/categorize-tweets';

/**
 * POST /api/ai/sort-inbox
 * Pro only. Batch-classifies up to 50 uncategorized tweets into the user's taxonomy.
 * Returns { sorted: number, errors: number }.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  // Enforce Pro plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profile?.plan !== 'pro') {
    return Response.json({ error: 'Pro plan required' }, { status: 403 });
  }

  // Fetch user's themes (id + name) — needed to build the themeMap for collection linking
  const { data: themesData } = await supabase
    .from('themes')
    .select('id, name')
    .eq('user_id', user.id);

  if (!themesData || themesData.length === 0) {
    return Response.json({ sorted: 0, errors: 0, message: 'No themes defined' });
  }

  const themeMap = new Map<string, string>(
    themesData.map((t: { id: string; name: string }) => [t.name.toLowerCase(), t.id])
  );

  // Fetch uncategorized tweets (up to 50)
  const { data: tweets } = await supabase
    .from('tweets')
    .select('id, content, author_handle, content_type, image_urls, article_title, article_description, article_body, thread_content')
    .eq('user_id', user.id)
    .is('collection_id', null)
    .limit(50);

  if (!tweets || tweets.length === 0) {
    return Response.json({ sorted: 0, errors: 0 });
  }

  const { categorized: sorted, errors } = await categorizeTweetBatch(supabase, user.id, tweets, {
    themeMap,
  });

  return Response.json({ sorted, errors });
}
