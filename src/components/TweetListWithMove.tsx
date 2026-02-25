'use client';

import { useState } from 'react';
import TweetCard from '@/components/TweetCard';
import MoveTweetButton from '@/components/MoveTweetButton';
import type { Tweet } from '@/types/database';

type FilterType = 'all' | 'tweet' | 'thread' | 'article';

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Tweets', value: 'tweet' },
  { label: 'Threads', value: 'thread' },
  { label: 'Articles', value: 'article' },
];

interface CollectionOption {
  id: string;
  name: string;
}

export default function TweetListWithMove({
  tweets: initialTweets,
  collections,
}: {
  tweets: Tweet[];
  collections: CollectionOption[];
}) {
  const [tweets, setTweets] = useState(initialTweets);
  const [filter, setFilter] = useState<FilterType>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  function handleMoved(tweetId: string) {
    setTweets((prev) => prev.filter((t) => t.id !== tweetId));
  }

  async function handleDelete(tweetId: string) {
    setDeleting(tweetId);
    const res = await fetch(`/api/tweets/${tweetId}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) {
      setTweets((prev) => prev.filter((t) => t.id !== tweetId));
    }
  }

  const counts: Record<FilterType, number> = {
    all: tweets.length,
    tweet: tweets.filter((t) => (t.content_type ?? 'tweet') === 'tweet').length,
    thread: tweets.filter((t) => t.content_type === 'thread').length,
    article: tweets.filter((t) => t.content_type === 'article').length,
  };

  const filtered =
    filter === 'all'
      ? tweets
      : tweets.filter((t) => (t.content_type ?? 'tweet') === filter);

  if (tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-2xl text-parchment">No sources yet</h2>
        <p className="mt-3 max-w-md text-sm text-mist">
          All your items have been organized into collections.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-6 flex gap-0 border-b border-seam">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`-mb-px border-b-2 px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors ${
              filter === value
                ? 'border-gold text-parchment'
                : 'border-transparent text-shadow hover:text-mist'
            }`}
          >
            {label} ({counts[value]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center font-mono text-xs text-shadow">
          No {filter}s in your sources.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((tweet) => (
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              actions={
                <div className="flex items-center gap-4">
                  <MoveTweetButton
                    tweetId={tweet.id}
                    currentCollectionId={tweet.collection_id}
                    collections={collections}
                    onMoved={handleMoved}
                  />
                  <button
                    onClick={() => handleDelete(tweet.id)}
                    disabled={deleting === tweet.id}
                    className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deleting === tweet.id ? '...' : 'Delete'}
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
