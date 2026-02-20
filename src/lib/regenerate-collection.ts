import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { aiRouter } from '@/lib/ai-router';

/** Create a service-role Supabase client for background operations (bypasses RLS). */
function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type RawTweet = {
  id: string;
  author_handle: string;
  content: string;
  content_type?: string;
  image_urls?: string[];
  article_title?: string | null;
  article_description?: string | null;
  thread_content?: { content: string }[] | null;
  extracted_content?: string | null;
};

/**
 * Regenerate AI summary and conclusions for a collection using a two-pass approach:
 * 1. Extract specific gems from each tweet (persisted to extracted_content).
 * 2. Synthesize summary + conclusions from the extracted content.
 */
export async function regenerateCollectionDocument(
  collectionId: string,
  userId: string,
  supabase?: SupabaseServiceClient
) {
  const client = supabase ?? createServiceClient();

  const [collectionRes, tweetsRes] = await Promise.all([
    client.from('collections').select('name').eq('id', collectionId).single(),
    client
      .from('tweets')
      .select('id, author_handle, content, content_type, image_urls, article_title, article_description, thread_content, extracted_content')
      .eq('collection_id', collectionId)
      .eq('user_id', userId)
      .order('captured_at', { ascending: true }),
  ]);

  if (collectionRes.error || !collectionRes.data) {
    console.error(`[AI] Failed to fetch collection ${collectionId}:`, collectionRes.error?.message);
    return;
  }

  const rawTweets: RawTweet[] = tweetsRes.data ?? [];
  const collectionName = collectionRes.data.name;

  if (rawTweets.length === 0) {
    const { error } = await client
      .from('collections')
      .update({ ai_summary: null, ai_conclusions: null, summary_updated_at: new Date().toISOString() })
      .eq('id', collectionId);

    if (error) {
      console.error(`[AI] Failed to clear collection document ${collectionId}:`, error.message);
    }
    return;
  }

  // Pass 1: Extract specific content for tweets that don't have it yet
  const needsExtraction = rawTweets.filter((t) => !t.extracted_content);

  if (needsExtraction.length > 0) {
    const extractionResults = await Promise.allSettled(
      needsExtraction.map(async (tweet) => {
        const extracted = await aiRouter.extractContent(tweet, userId);
        if (extracted) {
          await client
            .from('tweets')
            .update({ extracted_content: extracted })
            .eq('id', tweet.id);
          tweet.extracted_content = extracted;
        }
      })
    );

    for (const r of extractionResults) {
      if (r.status === 'rejected') {
        console.error('[AI] Extraction error:', r.reason);
      }
    }
  }

  // Pass 2: Build synthesis input from extracted content (fall back to enriched raw content)
  const tweets = rawTweets.map((t) => {
    if (t.extracted_content) {
      return { author_handle: t.author_handle, content: t.extracted_content };
    }

    // Fallback: build enriched content from raw fields
    let enrichedContent = t.content;
    if (t.content_type === 'thread' && t.thread_content?.length) {
      enrichedContent = t.thread_content.map((tc) => tc.content).join('\n---\n');
    }
    if (t.content_type === 'article') {
      if (t.article_title) enrichedContent = `[Article: ${t.article_title}]\n` + enrichedContent;
      if (t.article_description) enrichedContent += `\n${t.article_description}`;
    }

    return { author_handle: t.author_handle, content: enrichedContent };
  });

  const [summary, conclusions] = await Promise.all([
    aiRouter.generateSummary(collectionName, tweets, userId),
    aiRouter.generateConclusions(collectionName, tweets, userId),
  ]);

  const updates: Record<string, unknown> = { summary_updated_at: new Date().toISOString() };
  if (summary) updates.ai_summary = summary;
  if (conclusions) updates.ai_conclusions = conclusions;

  const { error } = await client
    .from('collections')
    .update(updates)
    .eq('id', collectionId);

  if (error) {
    console.error(`[AI] Failed to update collection document ${collectionId}:`, error.message);
    return;
  }

  console.log(`[AI] Regenerated document for "${collectionName}" (${rawTweets.length} tweets, ${needsExtraction.length} extracted)`);
}
