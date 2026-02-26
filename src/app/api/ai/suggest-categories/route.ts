import { requireUser } from '@/lib/supabase/server';
import { aiRouter } from '@/lib/ai-router';

/**
 * GET /api/ai/suggest-categories
 * Pro only. Returns 12-15 suggested theme names based on the user's recent tweets.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  // Check plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profile?.plan !== 'pro') {
    return Response.json({ error: 'Pro plan required' }, { status: 403 });
  }

  // Sample up to 50 recent tweets for context
  const { data: tweets } = await supabase
    .from('tweets')
    .select('content')
    .eq('user_id', user.id)
    .order('captured_at', { ascending: false })
    .limit(50);

  if (!tweets || tweets.length === 0) {
    return Response.json({ suggestions: [] });
  }

  const sampleContent = tweets.map((t: { content: string }) => t.content).join('\n---\n');
  const suggestions = await aiRouter.suggestCategories(sampleContent, user.id);

  return Response.json({ suggestions });
}
