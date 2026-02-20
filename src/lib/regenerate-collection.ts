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

/**
 * Regenerate AI summary and conclusions for a collection.
 * Uses the service-role client to bypass RLS (safe for background/fire-and-forget use).
 * If no supabase client is provided, creates a service-role one.
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
      .select('author_handle, content')
      .eq('collection_id', collectionId)
      .eq('user_id', userId)
      .order('captured_at', { ascending: true }),
  ]);

  if (collectionRes.error || !collectionRes.data) {
    console.error(`[AI] Failed to fetch collection ${collectionId}:`, collectionRes.error?.message);
    return;
  }

  const tweets = tweetsRes.data ?? [];
  const collectionName = collectionRes.data.name;

  if (tweets.length === 0) {
    // Clear stale summary when collection is emptied
    const { error } = await client
      .from('collections')
      .update({ ai_summary: null, ai_conclusions: null, summary_updated_at: new Date().toISOString() })
      .eq('id', collectionId);

    if (error) {
      console.error(`[AI] Failed to clear collection document ${collectionId}:`, error.message);
    }
    return;
  }

  const [summary, conclusions] = await Promise.all([
    aiRouter.generateSummary(collectionName, tweets),
    aiRouter.generateConclusions(collectionName, tweets),
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

  console.log(`[AI] Regenerated document for "${collectionName}" (${tweets.length} tweets)`);
}
