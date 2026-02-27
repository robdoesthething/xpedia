'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Theme, ThemeDigest } from '@/types/database';

interface Props {
  themeId: string;
  theme: Theme;
  digests: ThemeDigest[];
  newTweetCount: number;
}

export default function ThemeSynthesisPanel({ themeId, theme, digests, newTweetCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDigests, setExpandedDigests] = useState<Set<string>>(
    new Set(digests.slice(0, 1).map((d) => d.id))
  );

  async function handleSynthesise() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/themes/${themeId}/synthesise`, { method: 'POST' });
    setLoading(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      if (body.warnings?.length) {
        setError(body.warnings.join(' '));
      }
      router.refresh();
    } else {
      setError(body.error ?? 'Synthesis failed. Please try again.');
    }
  }

  function toggleDigest(id: string) {
    setExpandedDigests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const hasInsights = theme.ai_insights && theme.ai_insights.length > 0;
  const hasKeyPeople = theme.ai_key_people && theme.ai_key_people.length > 0;

  return (
    <div className="space-y-8">
      {/* Synthesis section */}
      <div className="border border-seam">
        <div className="flex items-center justify-between border-b border-seam px-5 py-3">
          <h2 className="font-mono text-xs tracking-widest text-gold uppercase">Synthesis</h2>
          <div className="flex items-center gap-3">
            {newTweetCount > 0 && (
              <span className="font-mono text-xs text-mist">
                {newTweetCount} new tweet{newTweetCount !== 1 ? 's' : ''} since last synthesis
              </span>
            )}
            <button
              onClick={handleSynthesise}
              disabled={loading}
              className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors disabled:opacity-50"
            >
              {loading ? 'Synthesising\u2026' : 'Synthesise \u21bb'}
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <p className="mb-4 font-mono text-xs text-red-400">{error}</p>
          )}

          {!hasInsights && !hasKeyPeople && !error && (
            <p className="text-sm text-shadow">
              No synthesis yet. Click &ldquo;Synthesise&rdquo; to generate insights and key people from all tweets in this theme.
            </p>
          )}

          {hasInsights && (
            <div className="mb-6">
              <h3 className="mb-3 font-mono text-xs tracking-widest text-mist uppercase">Actionable Insights</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-mist">
                {theme.ai_insights!.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {hasKeyPeople && (
            <div>
              <h3 className="mb-3 font-mono text-xs tracking-widest text-mist uppercase">Key People to Follow</h3>
              <ul className="space-y-2">
                {theme.ai_key_people!.map((person) => (
                  <li key={person.handle} className="flex items-start gap-2 text-sm text-mist">
                    <a
                      href={`https://x.com/${person.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-gold hover:text-gold-bright transition-colors"
                    >
                      @{person.handle}
                    </a>
                    <span>— {person.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Digest history */}
      {digests.length > 0 && (
        <div className="border border-seam">
          <div className="border-b border-seam px-5 py-3">
            <h2 className="font-mono text-xs tracking-widest text-gold uppercase">Digest</h2>
          </div>
          <div className="divide-y divide-seam">
            {digests.map((digest) => {
              const expanded = expandedDigests.has(digest.id);
              const date = new Date(digest.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              return (
                <div key={digest.id} className="px-5 py-4">
                  <button
                    onClick={() => toggleDigest(digest.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-mono text-xs tracking-widest text-mist uppercase">
                      {date} — {digest.tweet_count} new tweet{digest.tweet_count !== 1 ? 's' : ''}
                    </span>
                    <span className="font-mono text-xs text-shadow">{expanded ? '\u25b2' : '\u25bc'}</span>
                  </button>

                  {expanded && (
                    <div className="mt-4 space-y-4">
                      {digest.kta.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-mono text-xs tracking-widest text-shadow uppercase">Key Takeaways &amp; Actions</h4>
                          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-mist">
                            {digest.kta.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                      {digest.new_voices.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-mono text-xs tracking-widest text-shadow uppercase">New Voices</h4>
                          <ul className="space-y-1">
                            {digest.new_voices.map((v) => (
                              <li key={v.handle} className="flex items-start gap-2 text-sm text-mist">
                                <a
                                  href={`https://x.com/${v.handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 font-mono text-gold hover:text-gold-bright transition-colors"
                                >
                                  @{v.handle}
                                </a>
                                <span>— {v.reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
