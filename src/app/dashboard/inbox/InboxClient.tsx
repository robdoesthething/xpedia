'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProLock from '@/components/ProLock';
import type { Collection } from '@/types/database';

interface InboxTweet {
  id: string;
  content: string;
  author_handle: string;
  tweet_url: string | null;
  tweet_date: string | null;
  ai_summary: string | null;
}

interface Props {
  tweets: InboxTweet[];
  collections: Collection[];
  isPro: boolean;
}

export default function InboxClient({ tweets: initialTweets, collections, isPro }: Props) {
  const router = useRouter();
  const [tweets, setTweets] = useState(initialTweets);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [sorting, setSorting] = useState(false);

  async function assignTweet(tweetId: string, collectionId: string) {
    if (!collectionId) return;
    setAssigning(tweetId);
    try {
      await fetch(`/api/tweets/${tweetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId }),
      });
      setTweets((prev) => prev.filter((t) => t.id !== tweetId));
    } finally {
      setAssigning(null);
    }
  }

  async function handleSortAll() {
    setSorting(true);
    try {
      const res = await fetch('/api/ai/sort-inbox', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSorting(false);
    }
  }

  if (tweets.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-mono text-sm text-shadow">Inbox is empty — all tweets are categorized.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-end">
        <ProLock isPro={isPro} reason="feature">
          <button
            onClick={handleSortAll}
            disabled={sorting}
            className="border border-gold/50 text-gold font-mono text-xs tracking-widest uppercase px-4 py-2 hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            {sorting ? 'Sorting...' : '✦ AI Sort All'}
          </button>
        </ProLock>
      </div>

      <div className="space-y-2">
        {tweets.map((tweet) => (
          <div
            key={tweet.id}
            className="flex items-start gap-4 border border-seam bg-ink p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-mist mb-1">@{tweet.author_handle}</p>
              <p className="text-sm text-parchment leading-relaxed line-clamp-3">{tweet.content}</p>
              {tweet.ai_summary && (
                <p className="mt-1 text-xs text-shadow italic">{tweet.ai_summary}</p>
              )}
            </div>
            <div className="shrink-0">
              <select
                defaultValue=""
                disabled={assigning === tweet.id}
                onChange={(e) => assignTweet(tweet.id, e.target.value)}
                className="bg-void border border-seam px-3 py-2 text-xs text-mist focus:border-gold focus:outline-none transition-colors disabled:opacity-50"
              >
                <option value="" disabled>Assign to...</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
