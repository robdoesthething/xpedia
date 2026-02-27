import { aiRouter } from '@/lib/ai-router';
import { scrapeArticleBody } from '@/lib/article-scraper';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CategorizableTweet = {
  id: string;
  content: string;
  author_handle: string;
  content_type?: string;
  image_urls?: string[];
  article_url?: string | null;
  article_title?: string | null;
  article_description?: string | null;
  article_body?: string | null;
  thread_content?: { content: string }[] | null;
};

export type CategorizeTweetsOptions = {
  /** When provided, article bodies are scraped for tweets missing one. */
  scrapeArticles?: boolean;
  /**
   * When provided, collection inserts will include a theme_id.
   * Tweets whose AI-assigned theme_name is not found in this map are skipped.
   * Map key: lowercase theme name, value: theme UUID.
   */
  themeMap?: Map<string, string>;
};

export type CategorizeTweetsResult = {
  categorized: number;
  errors: number;
  affectedCollectionIds: Set<string>;
};

/**
 * Core tweet-categorization loop shared by:
 *  - POST /api/tweets/categorize
 *  - POST /api/ai/sort-inbox
 *
 * For each tweet it:
 *  1. Optionally scrapes the article body (when scrapeArticles = true).
 *  2. Calls aiRouter.categorize() to get a theme + collection suggestion.
 *  3. Resolves or creates the matching collection (with a race-condition ilike fallback).
 *     When themeMap is provided the collection is linked to the resolved theme_id;
 *     tweets whose theme cannot be resolved are skipped.
 *  4. Updates the tweet row with collection_id and ai_summary.
 *
 * Returns categorized/error counts plus the set of affected collection IDs so the
 * caller can trigger document regeneration if needed.
 */
export async function categorizeTweetBatch(
  supabase: SupabaseClient,
  userId: string,
  tweets: CategorizableTweet[],
  options: CategorizeTweetsOptions = {}
): Promise<CategorizeTweetsResult> {
  const { scrapeArticles = false, themeMap } = options;

  let categorized = 0;
  let errors = 0;
  const affectedCollectionIds = new Set<string>();

  // Fetch user's themes for the AI prompt
  const { data: themesData } = await supabase
    .from('themes')
    .select('name')
    .eq('user_id', userId)
    .order('name');

  const userThemeNames = (themesData ?? []).map((t: { name: string }) => t.name);

  // Fetch existing collections
  const { data: collectionsData } = await supabase
    .from('collections')
    .select('id, name')
    .eq('user_id', userId);

  const collectionNames = (collectionsData ?? []).map((c: { name: string }) => c.name);
  const collectionMap = new Map<string, string>(
    (collectionsData ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
  );

  // Process tweets sequentially to stay within free-tier AI rate limits
  for (const tweet of tweets) {
    try {
      // Optionally scrape the article body before sending to AI
      if (scrapeArticles && tweet.content_type === 'article' && tweet.article_url && !tweet.article_body) {
        const body = await scrapeArticleBody(tweet.article_url);
        if (body) {
          tweet.article_body = body;
          await supabase
            .from('tweets')
            .update({ article_body: body })
            .eq('id', tweet.id);
          console.log(`[AI] Scraped article body for tweet ${tweet.id} (${body.length} chars)`);
        }
      }

      const result = await aiRouter.categorize(tweet, collectionNames, userId, userThemeNames);

      if (!result || result.theme_name === '__uncategorized__') {
        if (result?.theme_name === '__uncategorized__') {
          console.log(`[AI] Tweet ${tweet.id} → uncategorized (no matching theme)`);
        }
        continue;
      }

      // When a themeMap is provided, the resolved theme_id must exist
      let themeId: string | undefined;
      if (themeMap) {
        themeId = themeMap.get(result.theme_name.toLowerCase());
        if (!themeId) {
          console.warn(`[AI] Unknown theme "${result.theme_name}" for tweet ${tweet.id} — skipping`);
          continue;
        }
      }

      // Resolve or create the collection
      let collectionId = collectionMap.get(result.collection_name.toLowerCase());

      if (!collectionId) {
        const insertPayload: Record<string, unknown> = {
          user_id: userId,
          name: result.collection_name,
          type: 'topic',
        };
        if (themeId) insertPayload.theme_id = themeId;

        const { data: newCol, error: colErr } = await supabase
          .from('collections')
          .insert(insertPayload)
          .select('id')
          .single();

        if (colErr || !newCol) {
          // Race condition: another request may have inserted the row — try to find it
          const { data: existing } = await supabase
            .from('collections')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', result.collection_name)
            .single();

          if (existing) {
            collectionId = existing.id;
          } else {
            console.error(`[AI] Failed to create collection "${result.collection_name}":`, colErr?.message);
            errors++;
            continue;
          }
        } else {
          collectionId = newCol.id;
          collectionMap.set(result.collection_name.toLowerCase(), newCol.id);
          collectionNames.push(result.collection_name);
          console.log(`[AI] Created collection "${result.collection_name}" (${newCol.id})`);
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

      console.log(`[AI] Tweet ${tweet.id} → "${result.collection_name}" via ${result.provider}`);
      affectedCollectionIds.add(collectionId!);
      categorized++;
    } catch (err) {
      console.error(`[AI] Error categorizing tweet ${tweet.id}:`, err);
      errors++;
    }
  }

  return { categorized, errors, affectedCollectionIds };
}
