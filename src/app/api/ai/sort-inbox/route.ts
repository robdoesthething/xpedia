import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { aiRouter } from '@/lib/ai-router';

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

  // Fetch user's themes (id + name)
  const { data: themesData } = await supabase
    .from('themes')
    .select('id, name')
    .eq('user_id', user.id);

  if (!themesData || themesData.length === 0) {
    return Response.json({ sorted: 0, errors: 0, message: 'No themes defined' });
  }

  const userThemeNames = themesData.map((t: { name: string }) => t.name);
  const themeMap = new Map<string, string>(
    themesData.map((t: { id: string; name: string }) => [t.name.toLowerCase(), t.id])
  );

  // Fetch existing collections (for reuse)
  const { data: collectionsData } = await supabase
    .from('collections')
    .select('id, name, theme_id')
    .eq('user_id', user.id);

  const collectionMap = new Map<string, string>(
    (collectionsData ?? []).map((c: { name: string; id: string }) => [c.name.toLowerCase(), c.id])
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

  const collectionNames = [...collectionMap.keys()].map((k) =>
    (collectionsData ?? []).find((c: { name: string }) => c.name.toLowerCase() === k)?.name ?? k
  );

  let sorted = 0;
  let errors = 0;

  for (const tweet of tweets) {
    try {
      const result = await aiRouter.categorize(
        tweet as Parameters<typeof aiRouter.categorize>[0],
        collectionNames,
        user.id,
        userThemeNames
      );

      if (!result || result.theme_name === '__uncategorized__') continue;

      // Resolve theme ID
      const themeId = themeMap.get(result.theme_name.toLowerCase());
      if (!themeId) {
        console.warn(`[AI] sort-inbox: unknown theme "${result.theme_name}" for tweet ${tweet.id}`);
        continue;
      }

      // Resolve or create collection, linked to the theme
      let collectionId = collectionMap.get(result.collection_name.toLowerCase());

      if (!collectionId) {
        const { data: newCol, error: colErr } = await supabase
          .from('collections')
          .insert({ user_id: user.id, name: result.collection_name, type: 'topic', theme_id: themeId })
          .select('id')
          .single();

        if (colErr || !newCol) {
          // Race condition — try to find it
          const { data: existing } = await supabase
            .from('collections')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', result.collection_name)
            .single();

          if (existing) {
            collectionId = existing.id;
          } else {
            console.error(`[AI] sort-inbox: failed to create collection "${result.collection_name}":`, colErr?.message);
            errors++;
            continue;
          }
        } else {
          collectionId = newCol.id;
          collectionMap.set(result.collection_name.toLowerCase(), newCol.id);
          collectionNames.push(result.collection_name);
          console.log(`[AI] sort-inbox: created collection "${result.collection_name}" in theme "${result.theme_name}"`);
        }
      }

      const { error: updateErr } = await supabase
        .from('tweets')
        .update({ collection_id: collectionId, ai_summary: result.summary })
        .eq('id', tweet.id);

      if (updateErr) {
        console.error(`[AI] sort-inbox: failed to assign tweet ${tweet.id}:`, updateErr.message);
        errors++;
        continue;
      }

      console.log(`[AI] sort-inbox: tweet ${tweet.id} → "${result.collection_name}" (${result.theme_name})`);
      sorted++;
    } catch (err) {
      console.error(`[AI] sort-inbox: error on tweet ${tweet.id}:`, err);
      errors++;
    }
  }

  return Response.json({ sorted, errors });
}
