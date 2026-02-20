'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CategorizeButton({ tweetCount }: { tweetCount: number }) {
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);
  const router = useRouter();

  async function handleCategorize() {
    setLoading(true);
    setQueued(null);

    const res = await fetch('/api/tweets/categorize', { method: 'POST' });

    if (res.ok) {
      const data = await res.json();
      setQueued(data.queued ?? 0);
      // Refresh after a delay to let background categorization work
      setTimeout(() => {
        router.refresh();
        setLoading(false);
        setQueued(null);
      }, 5000);
    } else {
      setLoading(false);
    }
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
      {queued !== null && (
        <span className="text-sm text-gray-500">
          {queued} tweets queued for AI categorization. Refreshing shortly...
        </span>
      )}
    </div>
  );
}
