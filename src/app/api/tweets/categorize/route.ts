import { requireUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { categorizeTweetBatch } from '@/lib/categorize-tweets';

export const maxDuration = 60;

/**
 * POST /api/tweets/categorize — Re-categorize uncategorized tweets using AI.
 * Auth: Cookie-based.
 * Runs synchronously so the caller gets a real result (not fire-and-forget).
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  // 3 categorize calls per minute per user
  const rl = checkRateLimit(`categorize:${user.id}`, 3, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait before categorizing again.');

  const supabase = createServiceClient();

  // Fetch uncategorized tweets with rich fields
  const { data: tweets, error: tweetsErr } = await supabase
    .from('tweets')
    .select('id, content, author_handle, content_type, image_urls, article_url, article_title, article_description, article_body, thread_content')
    .eq('user_id', user.id)
    .is('collection_id', null)
    .order('captured_at', { ascending: false })
    .limit(50);

  if (tweetsErr) {
    console.error('[AI] Failed to fetch uncategorized tweets:', tweetsErr.message);
    return Response.json({ error: 'Failed to fetch tweets' }, { status: 500 });
  }

  if (!tweets || tweets.length === 0) {
    return Response.json({ categorized: 0 });
  }

  let categorized = 0;
  let errors = 0;

  try {
    const result = await categorizeTweetBatch(supabase, user.id, tweets, {
      scrapeArticles: true,
    });

    categorized = result.categorized;
    errors = result.errors;

    // Regenerate documents for all affected collections
    if (result.affectedCollectionIds.size > 0) {
      await Promise.allSettled(
        [...result.affectedCollectionIds].map((id) =>
          regenerateCollectionDocument(id, user.id, supabase)
        )
      );
    }
  } catch (err) {
    console.error('[AI] Categorization failed:', err);
  }

  return Response.json({ categorized, errors });
}
