import { NextRequest } from 'next/server';
import { createClientFromToken } from '@/lib/supabase/api';
import { getCorsHeaders, corsOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

/**
 * GET /api/tweets/urls — Returns saved tweet URLs for client-side dedup.
 * Auth: Bearer token (used by Chrome extension).
 */
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request);
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

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
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const { data, error } = await supabase
    .from('tweets')
    .select('tweet_url')
    .eq('user_id', user.id);

  if (error) {
    console.error('[Capture] Failed to fetch saved URLs:', error.message);
    return Response.json(
      { error: 'Failed to fetch saved URLs' },
      { status: 500, headers: cors }
    );
  }

  const urls = data?.map((row) => row.tweet_url) ?? [];

  return Response.json({ urls }, { headers: cors });
}
