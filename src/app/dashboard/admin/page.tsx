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
    value >= warn   ? 'bg-gold' :
                      'bg-emerald-500';
  return (
    <div className="h-1 w-full bg-seam">
      <div className={`h-1 ${color}`} style={{ width: `${value}%` }} />
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRows = allRows.filter((r) => new Date(r.created_at) >= todayStart);

  const successRows = allRows.filter((r) => r.operation !== 'rate_limited');
  const todaySuccessRows = todayRows.filter((r) => r.operation !== 'rate_limited');

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

    return { provider, todayCalls, todayRateLimited, allTimeCalls, todayTokensIn, todayTokensOut, reqPct, tokenPct };
  });

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
        <h2 className="font-serif text-3xl text-parchment">AI Usage</h2>
        <p className="mt-1 font-mono text-xs text-shadow">Model usage, quotas, and per-task breakdown.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total calls', value: fmt(totalCalls) },
          { label: 'Tokens in', value: fmt(totalTokensIn) },
          { label: 'Tokens out', value: fmt(totalTokensOut) },
          { label: 'Rate limits hit', value: fmt(totalRateLimited) },
        ].map(({ label, value }) => (
          <div key={label} className="border border-seam bg-ink p-4">
            <p className="font-mono text-xs tracking-widest text-shadow uppercase">{label}</p>
            <p className="mt-2 font-serif text-3xl text-parchment">{value}</p>
          </div>
        ))}
      </div>

      {/* Quota per provider */}
      <section>
        <h3 className="mb-4 font-mono text-xs tracking-widest text-gold uppercase">
          Provider quotas — today
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providerStats.map(({ provider, todayCalls, todayRateLimited, allTimeCalls, todayTokensIn, todayTokensOut, reqPct, tokenPct }) => (
            <div key={provider.name} className="border border-seam bg-ink p-4">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="font-serif text-lg text-parchment">{provider.name}</p>
                  <p className="font-mono text-xs text-shadow">{provider.model}</p>
                </div>
                {todayRateLimited > 0 && (
                  <span className="border border-red-800 font-mono text-xs tracking-widest text-red-400 uppercase px-2 py-0.5">
                    {todayRateLimited} throttled
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 flex justify-between font-mono text-xs text-shadow">
                    <span>Requests / day</span>
                    <span>{fmt(todayCalls)} / {fmt(provider.quota.requestsPerDay)} ({reqPct}%)</span>
                  </div>
                  <ProgressBar value={reqPct} />
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between font-mono text-xs text-shadow">
                    <span>Tokens today</span>
                    <span>{fmt(todayTokensIn + todayTokensOut)}</span>
                  </div>
                  <ProgressBar value={tokenPct} />
                </div>
              </div>

              <div className="mt-4 flex gap-4 border-t border-seam pt-3 font-mono text-xs text-shadow">
                <span>All-time: {fmt(allTimeCalls)} calls</span>
                <span>RPM: {provider.quota.requestsPerMinute}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-shadow">
          Limits are free-tier estimates — verify against each provider&apos;s dashboard.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By task */}
        <section>
          <h3 className="mb-4 font-mono text-xs tracking-widest text-gold uppercase">By task</h3>
          <div className="border border-seam bg-ink overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-seam">
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-widest text-shadow uppercase">Operation</th>
                  <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">Calls</th>
                  <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">In</th>
                  <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-seam">
                {sortedByOperation.map(([op, s]) => (
                  <tr key={op}>
                    <td className="px-4 py-3 text-sm text-parchment">{op}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-mist">{fmt(s.calls)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-mist">{fmt(s.tokensIn)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-mist">{fmt(s.tokensOut)}</td>
                  </tr>
                ))}
                {sortedByOperation.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center font-mono text-xs text-shadow">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By user */}
        <section>
          <h3 className="mb-4 font-mono text-xs tracking-widest text-gold uppercase">By user</h3>
          <div className="border border-seam bg-ink overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-seam">
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-widest text-shadow uppercase">User ID</th>
                  <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">Calls</th>
                  <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">In</th>
                  <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-seam">
                {sortedByUser.map(([userId, s]) => (
                  <tr key={userId}>
                    <td className="px-4 py-3 font-mono text-xs text-mist truncate max-w-[140px]">{userId}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-mist">{fmt(s.calls)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-mist">{fmt(s.tokensIn)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-mist">{fmt(s.tokensOut)}</td>
                  </tr>
                ))}
                {sortedByUser.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center font-mono text-xs text-shadow">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Recent calls */}
      <section>
        <h3 className="mb-4 font-mono text-xs tracking-widest text-gold uppercase">Recent calls</h3>
        <div className="border border-seam bg-ink overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-seam">
                <th className="px-4 py-3 text-left font-mono text-xs tracking-widest text-shadow uppercase">Time</th>
                <th className="px-4 py-3 text-left font-mono text-xs tracking-widest text-shadow uppercase">Provider</th>
                <th className="px-4 py-3 text-left font-mono text-xs tracking-widest text-shadow uppercase">Operation</th>
                <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">In</th>
                <th className="px-4 py-3 text-right font-mono text-xs tracking-widest text-shadow uppercase">Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seam">
              {recent.map((row, i) => (
                <tr key={i} className={row.operation === 'rate_limited' ? 'bg-red-950/30' : ''}>
                  <td className="px-4 py-2 font-mono text-xs text-shadow">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-mist">{row.provider}</td>
                  <td className={`px-4 py-2 font-mono text-xs ${row.operation === 'rate_limited' ? 'text-red-400' : 'text-mist'}`}>
                    {row.operation}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-shadow">{fmt(row.tokens_in ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-shadow">{fmt(row.tokens_out ?? 0)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center font-mono text-xs text-shadow">No calls yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
