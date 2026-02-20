'use client';

import { useState } from 'react';
import type { Tweet } from '@/types/database';

export default function TweetCard({
  tweet,
  actions,
}: {
  tweet: Tweet;
  actions?: React.ReactNode;
}) {
  const [threadExpanded, setThreadExpanded] = useState(false);

  const displayDate = tweet.tweet_date
    ? new Date(tweet.tweet_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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

  const images = tweet.image_urls?.slice(0, 3) ?? [];
  const threadTweets = tweet.thread_content ?? [];

  let articleDomain: string | null = null;
  if (tweet.article_url) {
    try {
      articleDomain = new URL(tweet.article_url).hostname.replace(/^www\./, '');
    } catch {
      articleDomain = null;
    }
  }

  return (
    <article className="rounded-lg border border-stone-200 bg-white">
      <div className="p-5">
        {/* Header: Headline + Type badge */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug text-stone-900">
            {headline}
          </h3>
          {tweet.content_type === 'thread' && (
            <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
              Thread
            </span>
          )}
          {tweet.content_type === 'article' && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Article
            </span>
          )}
        </div>

        {/* Body */}
        {body && (
          <p className="mt-2 text-sm leading-relaxed text-stone-600 line-clamp-3">
            {body}
          </p>
        )}

        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="mt-3 flex gap-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className="h-20 w-32 rounded object-cover"
              />
            ))}
          </div>
        )}

        {/* AI Summary */}
        {tweet.ai_summary && (
          <p className="mt-3 border-l-2 border-amber-200 pl-3 text-sm italic text-stone-500">
            {tweet.ai_summary}
          </p>
        )}

        {/* Article card */}
        {tweet.article_url && tweet.article_title && (
          <a
            href={tweet.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded border border-stone-200 p-3 hover:bg-stone-50"
          >
            <p className="text-sm font-semibold leading-snug text-stone-800">
              {tweet.article_title}
            </p>
            {tweet.article_description && (
              <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                {tweet.article_description}
              </p>
            )}
            {articleDomain && (
              <p className="mt-1 text-xs text-amber-600">
                {articleDomain} &rarr;
              </p>
            )}
          </a>
        )}

        {/* Thread expand toggle */}
        {threadTweets.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setThreadExpanded((v) => !v)}
              className="text-xs font-medium text-purple-600 hover:text-purple-800"
            >
              {threadExpanded
                ? 'Hide thread'
                : `Show thread (${threadTweets.length})`}
            </button>
            {threadExpanded && (
              <div className="mt-2 flex flex-col gap-2 border-l-2 border-purple-200 pl-3">
                {threadTweets.map((t, i) => (
                  <p key={i} className="text-sm leading-relaxed text-stone-700">
                    {t.content}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — byline + actions */}
      <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span className="font-medium text-stone-700">
            {tweet.author_name ?? `@${tweet.author_handle}`}
          </span>
          {tweet.author_name && <span>@{tweet.author_handle}</span>}
          {displayDate && (
            <>
              <span className="text-stone-300">&middot;</span>
              <span>{displayDate}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a
            href={tweet.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-amber-600 hover:text-amber-700"
          >
            View on X &rarr;
          </a>
          {actions}
        </div>
      </div>
    </article>
  );
}
