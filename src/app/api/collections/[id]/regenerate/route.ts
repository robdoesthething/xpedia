import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateCollectionDocument } from '@/lib/regenerate-collection';

export const maxDuration = 60;

/**
 * POST /api/collections/[id]/regenerate
 * Re-extracts and re-synthesizes the AI summary and conclusions for a collection.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the collection belongs to the user
  const { data: collection } = await supabase
    .from('collections')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!collection) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  await regenerateCollectionDocument(id, user.id);

  return Response.json({ success: true });
}
