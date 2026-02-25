import { requireUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { aiRouter } from '@/lib/ai-router';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user } = auth;

  if (!validateOrigin(_request)) return csrfForbidden();

  // 3 synthesis requests per minute per user
  const rl = checkRateLimit(`synthesise:${user.id}`, 3, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait before synthesising again.');

  const service = createServiceClient();

  // Fetch the theme
  const { data: theme } = await service
    .from('themes').select('id, synthesis_updated_at, last_tweet_count')
    .eq('id', id).eq('user_id', user.id).single();

  if (!theme) return Response.json({ error: 'Theme not found' }, { status: 404 });

  // Fetch all collections in this theme
  const { data: collections, error: collectionsErr } = await service
    .from('collections').select('id').eq('theme_id', id).eq('user_id', user.id);

  if (collectionsErr) {
    console.error('[DB] Failed to fetch collections for theme:', collectionsErr.message);
    return Response.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
  if (!collections?.length) return Response.json({ error: 'No collections in this theme' }, { status: 400 });

  const collectionIds = collections.map((c: { id: string }) => c.id);

  // Fetch all tweets in the theme
  const { data: allTweets, error: tweetsErr } = await service
    .from('tweets')
    .select('id, author_handle, content, extracted_content, captured_at')
    .in('collection_id', collectionIds)
    .order('captured_at', { ascending: true });

  if (tweetsErr) {
    console.error('[DB] Failed to fetch tweets for theme synthesis:', tweetsErr.message);
    return Response.json({ error: 'Failed to fetch tweets' }, { status: 500 });
  }
  if (!allTweets?.length) return Response.json({ error: 'No tweets in this theme' }, { status: 400 });

  // Build tweet input (prefer extracted_content)
  const tweetInputs = allTweets.map((t: { author_handle: string; content: string; extracted_content?: string | null }) => ({
    author_handle: t.author_handle,
    content: t.extracted_content ?? t.content,
  }));

  // Determine new tweets since last synthesis for digest
  const lastSynthAt = theme.synthesis_updated_at;
  const newTweetInputs = lastSynthAt
    ? allTweets
      .filter((t: { captured_at: string }) => t.captured_at > lastSynthAt)
      .map((t: { author_handle: string; content: string; extracted_content?: string | null }) => ({
        author_handle: t.author_handle,
        content: t.extracted_content ?? t.content,
      }))
    : tweetInputs;

  // Run synthesis and digest in parallel
  const [insights, keyPeople, digestResult] = await Promise.all([
    aiRouter.generateInsights(tweetInputs, user.id).catch((err) => {
      console.error('[AI] generateInsights threw:', err);
      return null;
    }),
    aiRouter.generateKeyPeople(tweetInputs, user.id).catch((err) => {
      console.error('[AI] generateKeyPeople threw:', err);
      return null;
    }),
    newTweetInputs.length > 0
      ? aiRouter.generateDigest(newTweetInputs, user.id).catch((err) => {
        console.error('[AI] generateDigest threw:', err);
        return null;
      })
      : Promise.resolve(null),
  ]);

  console.log(
    `[Synthesis] theme=${id} tweets=${allTweets.length} insights=${insights?.length ?? 'FAILED'} keyPeople=${keyPeople?.length ?? 'FAILED'} digest=${digestResult ? 'ok' : 'skipped/failed'}`
  );

  const now = new Date().toISOString();
  const warnings: string[] = [];
  if (!insights) warnings.push('Insights generation failed — previous insights preserved.');
  if (!keyPeople) warnings.push('Key people generation failed — previous data preserved.');

  // Only overwrite fields that succeeded — don't wipe good data with [] on failure
  const updatePayload: Record<string, unknown> = {
    synthesis_updated_at: now,
    last_tweet_count: allTweets.length,
  };
  if (insights) updatePayload.ai_insights = insights;
  if (keyPeople) updatePayload.ai_key_people = keyPeople;

  const { error: themeErr } = await service.from('themes')
    .update(updatePayload)
    .eq('id', id).eq('user_id', user.id);

  if (themeErr) {
    console.error('[AI] Failed to save theme synthesis:', themeErr.message);
    return Response.json({ error: 'Failed to save synthesis' }, { status: 500 });
  }

  // Insert digest entry if there are new tweets (even if AI failed, record the count)
  if (newTweetInputs.length > 0) {
    const { error: digestErr } = await service.from('theme_digests').insert({
      theme_id: id,
      user_id: user.id,
      tweet_count: newTweetInputs.length,
      kta: digestResult?.kta ?? [],
      new_voices: digestResult?.new_voices ?? [],
    });
    if (digestErr) console.error('[AI] Failed to insert digest:', digestErr.message);
  }

  return Response.json({
    ok: true,
    insights: insights?.length ?? 0,
    keyPeople: keyPeople?.length ?? 0,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
