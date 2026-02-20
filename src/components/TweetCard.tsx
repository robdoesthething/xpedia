import type { Tweet } from '@/types/database';

export default function TweetCard({
  tweet,
  actions,
}: {
  tweet: Tweet;
  actions?: React.ReactNode;
}) {
  const displayDate = tweet.tweet_date
    ? new Date(tweet.tweet_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Use the first sentence or first 120 chars of content as a headline
  const firstSentenceEnd = tweet.content.search(/[.!?]\s/);
  const headline =
    firstSentenceEnd > 0 && firstSentenceEnd <= 120
      ? tweet.content.slice(0, firstSentenceEnd + 1)
      : tweet.content.length > 120
        ? tweet.content.slice(0, 120).replace(/\s+\S*$/, '') + '...'
        : tweet.content;

  const body =
    firstSentenceEnd > 0 && firstSentenceEnd <= 120
      ? tweet.content.slice(firstSentenceEnd + 1).trim()
      : tweet.content.length > 120
        ? tweet.content.slice(headline.length - 3).replace(/^\.{3}/, '').trim()
        : null;

  return (
    <article className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="p-5">
        {/* Headline */}
        <h3 className="text-base font-semibold leading-snug text-gray-900">
          {headline}
        </h3>

        {/* Body */}
        {body && (
          <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-3">
            {body}
          </p>
        )}

        {/* AI Summary */}
        {tweet.ai_summary && (
          <p className="mt-3 border-l-2 border-blue-200 pl-3 text-sm italic text-gray-500">
            {tweet.ai_summary}
          </p>
        )}
      </div>

      {/* Footer — byline + actions */}
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">
            {tweet.author_name ?? `@${tweet.author_handle}`}
          </span>
          {tweet.author_name && <span>@{tweet.author_handle}</span>}
          {displayDate && (
            <>
              <span className="text-gray-300">&middot;</span>
              <span>{displayDate}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a
            href={tweet.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            View on X &rarr;
          </a>
          {actions}
        </div>
      </div>
    </article>
  );
}
