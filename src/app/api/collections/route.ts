import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/collections — Create a new collection manually.
 * Auth: Cookie-based.
 * Body: { name: string, type: 'topic' | 'project' }
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name: string; type: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 100) {
    return Response.json(
      { error: 'Name must be between 1 and 100 characters' },
      { status: 400 }
    );
  }

  if (body.type !== 'topic' && body.type !== 'project') {
    return Response.json(
      { error: 'Type must be "topic" or "project"' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: user.id, name, type: body.type })
    .select('id, name, type')
    .single();

  if (error) {
    console.error('[DB] Failed to create collection:', error.message);
    return Response.json({ error: 'Failed to create collection' }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
