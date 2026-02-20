'use client';

import { useState } from 'react';
import TweetCard from '@/components/TweetCard';
import MoveTweetButton from '@/components/MoveTweetButton';
import type { Tweet } from '@/types/database';

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

  function handleMoved(tweetId: string) {
    setTweets((prev) => prev.filter((t) => t.id !== tweetId));
  }

  if (tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-2xl text-parchment">No uncategorized items</h2>
        <p className="mt-3 max-w-md text-sm text-mist">
          All your items have been organized into collections.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tweets.map((tweet) => (
        <TweetCard
          key={tweet.id}
          tweet={tweet}
          actions={
            <MoveTweetButton
              tweetId={tweet.id}
              currentCollectionId={null}
              collections={collections}
              onMoved={handleMoved}
            />
          }
        />
      ))}
    </div>
  );
}
