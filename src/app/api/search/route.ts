import { requireUser } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
  const offset = Number(searchParams.get('offset') ?? 0);

  if (!q) {
    return Response.json({ results: [] });
  }

  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  // 30 search requests per minute per user
  const rl = checkRateLimit(`search:${user.id}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please slow down.');

  const { data, error } = await supabase
    .from('tweets')
    .select('id, author_handle, content, tweet_url, collection_id, collections(name)')
    .eq('user_id', user.id)
    .textSearch('search_vector', q, { type: 'websearch' })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Search] Error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }

  return Response.json({ results: data });
}
