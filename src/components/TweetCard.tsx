import type { Tweet } from '@/types/database';

export default function TweetCard({ tweet }: { tweet: Tweet }) {
  const displayDate = tweet.tweet_date
    ? new Date(tweet.tweet_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {tweet.author_name ?? `@${tweet.author_handle}`}
        </span>
        {tweet.author_name && (
          <span className="text-sm text-gray-500">@{tweet.author_handle}</span>
        )}
        {displayDate && (
          <>
            <span className="text-gray-300">&middot;</span>
            <span className="text-sm text-gray-500">{displayDate}</span>
          </>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-800">{tweet.content}</p>
      <a
        href={tweet.tweet_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        View on X
      </a>
    </div>
  );
}
