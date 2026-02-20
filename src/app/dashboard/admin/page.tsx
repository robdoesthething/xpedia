import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ALL_PROVIDERS } from '@/lib/ai-providers';

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type AiCallRow = {
  provider: string;
  operation: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  user_id: string | null;
};

function fmt(n: number) {
  return n.toLocaleString();
}

function pct(used: number, limit: number) {
  return Math.min(100, Math.round((used / limit) * 100));
}

function ProgressBar({ value, warn = 70, danger = 90 }: { value: number; warn?: number; danger?: number }) {
  const color =
    value >= danger ? 'bg-red-500' :
    value >= warn   ? 'bg-amber-400' :
                      'bg-emerald-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-stone-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    notFound();
  }

  const service = createServiceClient();

  const { data: rows } = await service
    .from('ai_calls')
    .select('provider, operation, tokens_in, tokens_out, created_at, user_id')
    .order('created_at', { ascending: false }) as { data: AiCallRow[] | null };

  const allRows = rows ?? [];

  // Split today vs all-time
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRows = allRows.filter((r) => new Date(r.created_at) >= todayStart);

  // Successful calls only (not rate_limited)
  const successRows = allRows.filter((r) => r.operation !== 'rate_limited');
  const todaySuccessRows = todayRows.filter((r) => r.operation !== 'rate_limited');

  // Per-provider stats
  const providerStats = ALL_PROVIDERS.map((provider) => {
    const todayCalls = todaySuccessRows.filter((r) => r.provider === provider.name).length;
    const todayRateLimited = todayRows.filter(
      (r) => r.provider === provider.name && r.operation === 'rate_limited'
    ).length;
    const allTimeCalls = successRows.filter((r) => r.provider === provider.name).length;
    const todayTokensIn = todaySuccessRows
      .filter((r) => r.provider === provider.name)
      .reduce((s, r) => s + (r.tokens_in ?? 0), 0);
    const todayTokensOut = todaySuccessRows
      .filter((r) => r.provider === provider.name)
      .reduce((s, r) => s + (r.tokens_out ?? 0), 0);

    const reqPct = pct(todayCalls, provider.quota.requestsPerDay);
    const tokenPct = pct(todayTokensIn + todayTokensOut, provider.quota.tokensPerMinute * 60 * 24);

    return {
      provider,
      todayCalls,
      todayRateLimited,
      allTimeCalls,
      todayTokensIn,
      todayTokensOut,
      reqPct,
      tokenPct,
    };
  });

  // Aggregate by operation
  const byOperation = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();
  for (const row of successRows) {
    const e = byOperation.get(row.operation) ?? { calls: 0, tokensIn: 0, tokensOut: 0 };
    byOperation.set(row.operation, {
      calls: e.calls + 1,
      tokensIn: e.tokensIn + (row.tokens_in ?? 0),
      tokensOut: e.tokensOut + (row.tokens_out ?? 0),
    });
  }
  const sortedByOperation = [...byOperation.entries()].sort((a, b) => b[1].calls - a[1].calls);

  // Aggregate by user
  const byUser = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();
  for (const row of successRows) {
    const key = row.user_id ?? 'anonymous';
    const e = byUser.get(key) ?? { calls: 0, tokensIn: 0, tokensOut: 0 };
    byUser.set(key, {
      calls: e.calls + 1,
      tokensIn: e.tokensIn + (row.tokens_in ?? 0),
      tokensOut: e.tokensOut + (row.tokens_out ?? 0),
    });
  }
  const sortedByUser = [...byUser.entries()].sort((a, b) => b[1].calls - a[1].calls);

  const totalCalls = successRows.length;
  const totalTokensIn = successRows.reduce((s, r) => s + (r.tokens_in ?? 0), 0);
  const totalTokensOut = successRows.reduce((s, r) => s + (r.tokens_out ?? 0), 0);
  const totalRateLimited = allRows.filter((r) => r.operation === 'rate_limited').length;

  const recent = allRows.slice(0, 30);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">AI Usage</h2>
        <p className="mt-1 text-sm text-stone-500">Model usage, quotas, and per-task breakdown.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total calls', value: fmt(totalCalls) },
          { label: 'Tokens in', value: fmt(totalTokensIn) },
          { label: 'Tokens out', value: fmt(totalTokensOut) },
          { label: 'Rate limits hit', value: fmt(totalRateLimited) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Quota per provider */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">
          Provider quotas — today
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providerStats.map(({ provider, todayCalls, todayRateLimited, allTimeCalls, todayTokensIn, todayTokensOut, reqPct, tokenPct }) => (
            <div key={provider.name} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-stone-900">{provider.name}</p>
                  <p className="text-xs text-stone-400">{provider.model}</p>
                </div>
                {todayRateLimited > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    {todayRateLimited} throttled
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-stone-500">
                    <span>Requests / day</span>
                    <span>{fmt(todayCalls)} / {fmt(provider.quota.requestsPerDay)} ({reqPct}%)</span>
                  </div>
                  <ProgressBar value={reqPct} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-stone-500">
                    <span>Tokens today</span>
                    <span>{fmt(todayTokensIn + todayTokensOut)}</span>
                  </div>
                  <ProgressBar value={tokenPct} />
                </div>
              </div>

              <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3 text-xs text-stone-400">
                <span>All-time: {fmt(allTimeCalls)} calls</span>
                <span>RPM limit: {provider.quota.requestsPerMinute}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Limits are free-tier estimates — verify against each provider&apos;s dashboard.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By task */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">By task</h3>
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-3">Operation</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Tokens in</th>
                  <th className="px-4 py-3 text-right">Tokens out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedByOperation.map(([op, s]) => (
                  <tr key={op}>
                    <td className="px-4 py-3 font-medium text-stone-800">{op}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.calls)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensIn)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensOut)}</td>
                  </tr>
                ))}
                {sortedByOperation.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By user */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">By user</h3>
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Tokens in</th>
                  <th className="px-4 py-3 text-right">Tokens out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedByUser.map(([userId, s]) => (
                  <tr key={userId}>
                    <td className="px-4 py-3 font-mono text-xs text-stone-500 truncate max-w-[140px]">{userId}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.calls)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensIn)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensOut)}</td>
                  </tr>
                ))}
                {sortedByUser.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Recent calls */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">Recent calls</h3>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3 text-right">Tokens in</th>
                <th className="px-4 py-3 text-right">Tokens out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recent.map((row, i) => (
                <tr key={i} className={row.operation === 'rate_limited' ? 'bg-red-50/50' : ''}>
                  <td className="px-4 py-2 text-xs text-stone-400">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-stone-700">{row.provider}</td>
                  <td className={`px-4 py-2 ${row.operation === 'rate_limited' ? 'font-medium text-red-600' : 'text-stone-600'}`}>
                    {row.operation}
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600">{fmt(row.tokens_in ?? 0)}</td>
                  <td className="px-4 py-2 text-right text-stone-600">{fmt(row.tokens_out ?? 0)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">No calls yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
