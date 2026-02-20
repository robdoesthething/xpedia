import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
  const offset = Number(searchParams.get('offset') ?? 0);

  if (!q) {
    return Response.json({ results: [] });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('tweets')
    .select('id, author_handle, content, tweet_url, collection_id, collections(name)')
    .textSearch('search_vector', q, { type: 'websearch' })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Search] Error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }

  return Response.json({ results: data });
}
