import { NextRequest } from 'next/server';
import { createClientFromToken } from '@/lib/supabase/api';
import { getCorsHeaders, corsOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request);
  const { searchParams } = new URL(request.url);
  const token =
    searchParams.get('access_token') ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return Response.json({ error: 'Missing auth token' }, { status: 401, headers: cors });
  }

  const supabase = createClientFromToken(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const { count, error } = await supabase
    .from('tweets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('collection_id', null);

  if (error) {
    console.error('[DB] Failed to count uncategorized tweets:', error.message);
    return Response.json({ error: 'Failed to count' }, { status: 500, headers: cors });
  }

  return Response.json({ count: count ?? 0 }, { headers: cors });
}
