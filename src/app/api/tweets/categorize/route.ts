import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { aiRouter } from '@/lib/ai-router';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';

/**
 * POST /api/tweets/categorize — Re-categorize uncategorized tweets using AI.
 * Auth: Cookie-based.
 * Triggers AI categorization on all tweets with collection_id = null.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch uncategorized tweets
  const { data: tweets, error: tweetsErr } = await supabase
    .from('tweets')
    .select('id, content, author_handle')
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

  // Fire-and-forget the actual categorization work
  void categorizeInBackground(
    tweets as { id: string; content: string; author_handle: string }[],
    user.id
  );

  return Response.json({ queued: tweets.length });
}

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function categorizeInBackground(
  tweets: { id: string; content: string; author_handle: string }[],
  userId: string
) {
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

    const results = await Promise.allSettled(
      tweets.map(async (tweet) => {
        const result = await aiRouter.categorize(tweet.content, tweet.author_handle, collectionNames);
        if (!result) return;

        // Resolve or create collection
        let collectionId = collectionMap.get(result.collection_name.toLowerCase());

        if (!collectionId) {
          const { data, error } = await supabase
            .from('collections')
            .insert({ user_id: userId, name: result.collection_name, type: 'topic' })
            .select('id')
            .single();

          if (error) {
            // Race condition fallback
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
              return;
            }
          } else {
            collectionId = data.id;
            collectionMap.set(result.collection_name.toLowerCase(), data.id);
            console.log(`[AI] Created collection "${result.collection_name}" (${data.id})`);
          }
        }

        const { error: updateErr } = await supabase
          .from('tweets')
          .update({ collection_id: collectionId, ai_summary: result.summary })
          .eq('id', tweet.id);

        if (updateErr) {
          console.error(`[AI] Failed to update tweet ${tweet.id}:`, updateErr.message);
          return;
        }

        console.log(`[AI] Tweet ${tweet.id} → collection "${result.collection_name}" via ${result.provider}`);
        affectedCollectionIds.add(collectionId!);
      })
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[AI] Categorization error:', r.reason);
      }
    }

    if (affectedCollectionIds.size > 0) {
      await Promise.allSettled(
        [...affectedCollectionIds].map((id) =>
          regenerateCollectionDocument(id, userId, supabase)
        )
      );
    }
  } catch (err) {
    console.error('[AI] Background categorization failed:', err);
  }
}
