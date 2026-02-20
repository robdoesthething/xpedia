import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

  // Aggregate by provider
  const byProvider = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();
  // Aggregate by operation
  const byOperation = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();
  // Aggregate by user
  const byUser = new Map<string, { calls: number; tokensIn: number; tokensOut: number }>();

  for (const row of allRows) {
    const inc = (map: typeof byProvider, key: string) => {
      const e = map.get(key) ?? { calls: 0, tokensIn: 0, tokensOut: 0 };
      map.set(key, {
        calls: e.calls + 1,
        tokensIn: e.tokensIn + (row.tokens_in ?? 0),
        tokensOut: e.tokensOut + (row.tokens_out ?? 0),
      });
    };
    inc(byProvider, row.provider);
    inc(byOperation, row.operation);
    inc(byUser, row.user_id ?? 'anonymous');
  }

  const totalCalls = allRows.length;
  const totalTokensIn = allRows.reduce((s, r) => s + (r.tokens_in ?? 0), 0);
  const totalTokensOut = allRows.reduce((s, r) => s + (r.tokens_out ?? 0), 0);

  const sortedByProvider = [...byProvider.entries()].sort((a, b) => b[1].calls - a[1].calls);
  const sortedByOperation = [...byOperation.entries()].sort((a, b) => b[1].calls - a[1].calls);
  const sortedByUser = [...byUser.entries()].sort((a, b) => b[1].calls - a[1].calls);
  const recent = allRows.slice(0, 30);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">AI Usage</h2>
        <p className="mt-1 text-sm text-stone-500">All-time model usage across operations and users.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total calls', value: fmt(totalCalls) },
          { label: 'Tokens in', value: fmt(totalTokensIn) },
          { label: 'Tokens out', value: fmt(totalTokensOut) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By model */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">By model</h3>
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Tokens in</th>
                  <th className="px-4 py-3 text-right">Tokens out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedByProvider.map(([provider, s]) => (
                  <tr key={provider}>
                    <td className="px-4 py-3 font-medium text-stone-800">{provider}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.calls)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensIn)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensOut)}</td>
                  </tr>
                ))}
                {sortedByProvider.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By operation */}
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
      </div>

      {/* By user */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">By user</h3>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Tokens in</th>
                <th className="px-4 py-3 text-right">Tokens out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sortedByUser.map(([userId, s]) => (
                <tr key={userId}>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{userId}</td>
                  <td className="px-4 py-3 text-stone-600">—</td>
                  <td className="px-4 py-3 text-right text-stone-600">{fmt(s.calls)}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensIn)}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{fmt(s.tokensOut)}</td>
                </tr>
              ))}
              {sortedByUser.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
                <tr key={i}>
                  <td className="px-4 py-2 text-xs text-stone-400">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-stone-700">{row.provider}</td>
                  <td className="px-4 py-2 text-stone-600">{row.operation}</td>
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
