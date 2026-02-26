import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

/**
 * POST /api/onboarding/complete
 * Marks the user's onboarding as completed so the modal no longer appears.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  return Response.json({ ok: true });
}
