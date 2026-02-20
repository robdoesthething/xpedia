import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();

  const { data: byProviderOp, error: e1 } = await service
    .from('ai_calls')
    .select('provider, operation, tokens_in, tokens_out')
    .order('created_at', { ascending: false });

  const { data: byUser, error: e2 } = await service
    .from('ai_calls')
    .select('user_id, operation, tokens_in, tokens_out');

  const { data: recent, error: e3 } = await service
    .from('ai_calls')
    .select('provider, operation, tokens_in, tokens_out, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(50);

  if (e1 || e2 || e3) {
    return Response.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }

  // Aggregate by provider+operation
  const providerOpMap = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();
  for (const row of byProviderOp ?? []) {
    const key = `${row.provider}||${row.operation}`;
    const existing = providerOpMap.get(key) ?? { calls: 0, tokensIn: 0, tokensOut: 0 };
    providerOpMap.set(key, {
      calls: existing.calls + 1,
      tokensIn: existing.tokensIn + (row.tokens_in ?? 0),
      tokensOut: existing.tokensOut + (row.tokens_out ?? 0),
    });
  }

  const providerOpStats = [...providerOpMap.entries()].map(([key, stats]) => {
    const [provider, operation] = key.split('||');
    return { provider, operation, ...stats };
  }).sort((a, b) => b.calls - a.calls);

  // Aggregate by user+operation
  const userOpMap = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();
  for (const row of byUser ?? []) {
    const key = `${row.user_id ?? 'unknown'}||${row.operation}`;
    const existing = userOpMap.get(key) ?? { calls: 0, tokensIn: 0, tokensOut: 0 };
    userOpMap.set(key, {
      calls: existing.calls + 1,
      tokensIn: existing.tokensIn + (row.tokens_in ?? 0),
      tokensOut: existing.tokensOut + (row.tokens_out ?? 0),
    });
  }

  const userOpStats = [...userOpMap.entries()].map(([key, stats]) => {
    const [userId, operation] = key.split('||');
    return { userId, operation, ...stats };
  }).sort((a, b) => b.calls - a.calls);

  return Response.json({ providerOpStats, userOpStats, recent });
}
