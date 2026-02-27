'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CategorizeButton({ tweetCount }: { tweetCount: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ categorized: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCategorize() {
    setLoading(true);
    setResult(null);
    setError(null);

    const res = await fetch('/api/tweets/categorize', { method: 'POST' });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      router.refresh();
    } else {
      setError('Failed to categorize. Please try again.');
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCategorize}
          disabled={loading}
          className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-4 py-2 hover:bg-gold-bright transition-colors focus:outline-none disabled:opacity-50"
        >
          {loading ? 'Categorizing...' : `Categorize ${tweetCount} items`}
        </button>
        {result && (
          <span className="font-mono text-xs text-mist">
            {result.categorized} categorized{result.errors > 0 ? `, ${result.errors} failed` : ''}
          </span>
        )}
      </div>
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
}
