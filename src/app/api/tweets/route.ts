import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createClientFromToken } from '@/lib/supabase/api';
import { corsHeaders, corsOptions } from '@/lib/cors';
import { aiRouter } from '@/lib/ai-router';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';
import type { CapturedTweet } from '@/types/database';

const MAX_TWEETS_PER_REQUEST = 100;

export async function OPTIONS() {
  return corsOptions();
}

/**
 * POST /api/tweets — Capture tweets from the Chrome extension.
 * Auth: Bearer token (extension can't use cookies).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return Response.json(
      { error: 'Missing Authorization header' },
      { status: 401, headers: corsHeaders }
    );
  }

  const supabase = createClientFromToken(token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[Capture] Auth failed:', authError?.message);
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  let body: { tweets: CapturedTweet[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  if (!Array.isArray(body.tweets) || body.tweets.length === 0) {
    return Response.json(
      { error: 'tweets must be a non-empty array' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (body.tweets.length > MAX_TWEETS_PER_REQUEST) {
    return Response.json(
      { error: `Maximum ${MAX_TWEETS_PER_REQUEST} tweets per request` },
      { status: 400, headers: corsHeaders }
    );
  }

  const rows = body.tweets.map((t) => ({
    user_id: user.id,
    tweet_url: t.tweet_url,
    author_handle: t.author_handle,
    author_name: t.author_name,
    content: t.content,
    tweet_date: t.tweet_date,
  }));

  const { data, error } = await supabase
    .from('tweets')
    .upsert(rows, { onConflict: 'user_id,tweet_url', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[Capture] DB insert error:', error.message);
    return Response.json(
      { error: 'Failed to save tweets' },
      { status: 500, headers: corsHeaders }
    );
  }

  const saved = data?.length ?? 0;
  const duplicates = body.tweets.length - saved;

  console.log(`[Capture] User ${user.id}: saved=${saved}, duplicates=${duplicates}`);

  if (saved > 0 && data) {
    const tweetIds = data.map((row: { id: string }) => row.id);
    void categorizeTweetsInBackground(tweetIds, user.id);
  }

  return Response.json({ saved, duplicates }, { headers: corsHeaders });
}

/**
 * GET /api/tweets — List tweets for the web app.
 * Auth: Cookie-based (standard Next.js server client).
 * Query params: collection_id (optional), limit (default 50), offset (default 0).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const collectionId = searchParams.get('collection_id');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
  const offset = Number(searchParams.get('offset')) || 0;

  let query = supabase
    .from('tweets')
    .select('*')
    .eq('user_id', user.id)
    .order('captured_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (collectionId === 'null' || collectionId === '') {
    query = query.is('collection_id', null);
  } else if (collectionId) {
    query = query.eq('collection_id', collectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Capture] DB query error:', error.message);
    return Response.json({ error: 'Failed to fetch tweets' }, { status: 500 });
  }

  return Response.json({ tweets: data });
}

// ---------------------------------------------------------------------------
// Background AI categorization (fire-and-forget)
// ---------------------------------------------------------------------------

/** Create a service-role Supabase client for background operations (bypasses RLS). */
function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function categorizeTweetsInBackground(tweetIds: string[], userId: string) {
  try {
    const supabase = createServiceClient();

    // Fetch saved tweets to get content
    const { data: tweets, error: tweetsErr } = await supabase
      .from('tweets')
      .select('id, content, author_handle')
      .in('id', tweetIds);

    if (tweetsErr || !tweets?.length) {
      console.error('[AI] Failed to fetch tweets for categorization:', tweetsErr?.message);
      return;
    }

    // Fetch user's existing collections
    const { data: collections } = await supabase
      .from('collections')
      .select('id, name')
      .eq('user_id', userId);

    const collectionNames = (collections ?? []).map((c: { name: string }) => c.name);
    const collectionMap = new Map(
      (collections ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
    );

    // Categorize all tweets in parallel
    const affectedCollectionIds = new Set<string>();

    const results = await Promise.allSettled(
      tweets.map(async (tweet: { id: string; content: string; author_handle: string }) => {
        const result = await aiRouter.categorize(tweet.content, tweet.author_handle, collectionNames);
        if (!result) return;

        // Resolve or create collection
        const collectionId = await resolveCollection(
          supabase,
          userId,
          result.collection_name,
          collectionMap
        );
        if (!collectionId) return;

        // Update tweet with collection assignment and AI summary
        const { error: updateErr } = await supabase
          .from('tweets')
          .update({ collection_id: collectionId, ai_summary: result.summary })
          .eq('id', tweet.id);

        if (updateErr) {
          console.error(`[AI] Failed to update tweet ${tweet.id}:`, updateErr.message);
          return;
        }

        console.log(`[AI] Tweet ${tweet.id} → collection "${result.collection_name}" via ${result.provider}`);
        affectedCollectionIds.add(collectionId);
      })
    );

    // Log any rejected promises
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[AI] Categorization error:', r.reason);
      }
    }

    // Regenerate document for each affected collection
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

async function resolveCollection(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  collectionName: string,
  collectionMap: Map<string, string>
): Promise<string | null> {
  // Check if collection already exists (case-insensitive)
  const existing = collectionMap.get(collectionName.toLowerCase());
  if (existing) return existing;

  // Create new collection
  const { data, error } = await supabase
    .from('collections')
    .insert({
      user_id: userId,
      name: collectionName,
      type: 'topic',
    })
    .select('id')
    .single();

  if (error) {
    // Race condition: another tweet may have created it — try to fetch
    const { data: fallback } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', collectionName)
      .single();

    if (fallback) {
      collectionMap.set(collectionName.toLowerCase(), fallback.id);
      return fallback.id;
    }

    console.error(`[AI] Failed to create collection "${collectionName}":`, error.message);
    return null;
  }

  // Cache for subsequent tweets in this batch
  collectionMap.set(collectionName.toLowerCase(), data.id);
  console.log(`[AI] Created collection "${collectionName}" (${data.id})`);
  return data.id;
}

