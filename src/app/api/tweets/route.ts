import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClientFromToken } from '@/lib/supabase/api';
import { getCorsHeaders, corsOptions } from '@/lib/cors';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import type { CapturedTweet } from '@/types/database';

const MAX_TWEETS_PER_REQUEST = 100;

export async function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

/**
 * POST /api/tweets — Capture tweets from the Chrome extension.
 * Auth: Bearer token (extension can't use cookies).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  const cors = getCorsHeaders(request);

  if (!token) {
    return Response.json(
      { error: 'Missing Authorization header' },
      { status: 401, headers: cors }
    );
  }

  const supabase = createClientFromToken(token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[Capture] Auth failed');
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  // 10 capture requests per minute per user
  const rl = checkRateLimit(`tweets:${user.id}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait before sending more tweets.', cors);

  let body: { tweets: CapturedTweet[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: cors });
  }

  if (!Array.isArray(body.tweets) || body.tweets.length === 0) {
    return Response.json(
      { error: 'tweets must be a non-empty array' },
      { status: 400, headers: cors }
    );
  }

  if (body.tweets.length > MAX_TWEETS_PER_REQUEST) {
    return Response.json(
      { error: `Maximum ${MAX_TWEETS_PER_REQUEST} tweets per request` },
      { status: 400, headers: cors }
    );
  }

  const rows = body.tweets.map((t) => ({
    user_id: user.id,
    tweet_url: t.tweet_url,
    author_handle: t.author_handle,
    author_name: t.author_name,
    content: t.content,
    tweet_date: t.tweet_date,
    content_type: t.content_type ?? 'tweet',
    image_urls: t.image_urls ?? [],
    article_url: t.article_url ?? null,
    article_title: t.article_title ?? null,
    article_description: t.article_description ?? null,
    thread_content: t.thread_content ?? null,
  }));

  const { data, error } = await supabase
    .from('tweets')
    .upsert(rows, { onConflict: 'user_id,tweet_url', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[Capture] DB insert error:', error.message);
    return Response.json(
      { error: 'Failed to save tweets' },
      { status: 500, headers: cors }
    );
  }

  const saved = data?.length ?? 0;
  const duplicates = body.tweets.length - saved;

  console.log(`[Capture] saved=${saved}, duplicates=${duplicates}`);

  return Response.json({ saved, duplicates }, { headers: cors });
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

