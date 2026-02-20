import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { aiRouter } from '@/lib/ai-router';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';

export const maxDuration = 60;

/**
 * POST /api/tweets/categorize — Re-categorize uncategorized tweets using AI.
 * Auth: Cookie-based.
 * Runs synchronously so the caller gets a real result (not fire-and-forget).
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch uncategorized tweets with rich fields
  const { data: tweets, error: tweetsErr } = await supabase
    .from('tweets')
    .select('id, content, author_handle, content_type, image_urls, article_url, article_title, article_description, thread_content')
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

  // Run categorization synchronously so it completes before the function exits
  const result = await categorizeTweets(
    tweets as {
      id: string; content: string; author_handle: string;
      content_type?: string; image_urls?: string[];
      article_url?: string | null; article_title?: string | null; article_description?: string | null;
      thread_content?: { content: string }[] | null;
    }[],
    user.id
  );

  return Response.json(result);
}

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function categorizeTweets(
  tweets: {
    id: string; content: string; author_handle: string;
    content_type?: string; image_urls?: string[];
    article_url?: string | null; article_title?: string | null; article_description?: string | null;
    thread_content?: { content: string }[] | null;
  }[],
  userId: string
): Promise<{ categorized: number; errors: number }> {
  let categorized = 0;
  let errors = 0;

  try {
    const supabase = createServiceClient();

    // Fetch existing collections
    const { data: collections } = await supabase
      .from('collections')
      .select('id, name')
      .eq('user_id', userId);

    const collectionNames = (collections ?? []).map((c: { name: string }) => c.name);
    const collectionMap = new Map(
      (collections ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
    );

    const affectedCollectionIds = new Set<string>();

    // Process tweets sequentially to avoid rate limits on free AI tiers
    for (const tweet of tweets) {
      try {
        const result = await aiRouter.categorize(tweet, collectionNames);
        if (!result) {
          errors++;
          continue;
        }

        // Resolve or create collection
        let collectionId = collectionMap.get(result.collection_name.toLowerCase());

        if (!collectionId) {
          const { data, error } = await supabase
            .from('collections')
            .insert({ user_id: userId, name: result.collection_name, type: 'topic' })
            .select('id')
            .single();

          if (error) {
            const { data: fallback } = await supabase
              .from('collections')
              .select('id')
              .eq('user_id', userId)
              .ilike('name', result.collection_name)
              .single();

            if (fallback) {
              collectionId = fallback.id;
            } else {
              console.error(`[AI] Failed to create collection "${result.collection_name}":`, error.message);
              errors++;
              continue;
            }
          } else {
            collectionId = data.id;
            collectionMap.set(result.collection_name.toLowerCase(), data.id);
            // Also add to collectionNames so subsequent AI calls see it
            collectionNames.push(result.collection_name);
            console.log(`[AI] Created collection "${result.collection_name}" (${data.id})`);
          }
        }

        const { error: updateErr } = await supabase
          .from('tweets')
          .update({ collection_id: collectionId, ai_summary: result.summary })
          .eq('id', tweet.id);

        if (updateErr) {
          console.error(`[AI] Failed to update tweet ${tweet.id}:`, updateErr.message);
          errors++;
          continue;
        }

        console.log(`[AI] Tweet ${tweet.id} → collection "${result.collection_name}" via ${result.provider}`);
        affectedCollectionIds.add(collectionId!);
        categorized++;
      } catch (err) {
        console.error(`[AI] Error categorizing tweet ${tweet.id}:`, err);
        errors++;
      }
    }

    // Regenerate documents for all affected collections
    if (affectedCollectionIds.size > 0) {
      await Promise.allSettled(
        [...affectedCollectionIds].map((id) =>
          regenerateCollectionDocument(id, userId, supabase)
        )
      );
    }
  } catch (err) {
    console.error('[AI] Categorization failed:', err);
  }

  return { categorized, errors };
}
