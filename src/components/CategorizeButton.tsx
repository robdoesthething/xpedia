'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CategorizeButton({ tweetCount }: { tweetCount: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ categorized: number; errors: number } | null>(null);
  const router = useRouter();

  async function handleCategorize() {
    setLoading(true);
    setResult(null);

    const res = await fetch('/api/tweets/categorize', { method: 'POST' });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleCategorize}
        disabled={loading}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? 'Categorizing...' : `Categorize ${tweetCount} tweets`}
      </button>
      {result && (
        <span className="text-sm text-gray-500">
          {result.categorized} categorized{result.errors > 0 ? `, ${result.errors} failed` : ''}
        </span>
      )}
    </div>
  );
}
