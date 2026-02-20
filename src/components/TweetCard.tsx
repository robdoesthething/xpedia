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
    <article className="border border-seam bg-ink">
      <div className="p-5">
        {/* Header: Headline + Type badge */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg leading-snug text-parchment">
            {headline}
          </h3>
          <div className="flex shrink-0 gap-1.5 mt-0.5">
            {tweet.content_type === 'thread' && (
              <span className="font-mono text-xs tracking-widest text-gold uppercase border border-gold/30 px-2 py-0.5">
                Thread
              </span>
            )}
            {tweet.content_type === 'article' && (
              <span className="font-mono text-xs tracking-widest text-gold uppercase border border-gold/30 px-2 py-0.5">
                Article
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        {body && (
          <p className="mt-2 text-sm leading-relaxed text-mist line-clamp-3">
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
                className="h-20 w-32 object-cover"
              />
            ))}
          </div>
        )}

        {/* AI Summary */}
        {tweet.ai_summary && (
          <p className="mt-3 border-l-2 border-gold/30 pl-3 text-sm italic text-mist">
            {tweet.ai_summary}
          </p>
        )}

        {/* Article card */}
        {tweet.article_url && tweet.article_title && (
          <a
            href={tweet.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block border border-seam p-3 hover:border-gold/40 hover:bg-quill transition-colors"
          >
            <p className="text-sm font-semibold leading-snug text-parchment">
              {tweet.article_title}
            </p>
            {tweet.article_description && (
              <p className="mt-1 text-xs text-mist line-clamp-2">
                {tweet.article_description}
              </p>
            )}
            {articleDomain && (
              <p className="mt-1 font-mono text-xs text-gold">
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
              className="font-mono text-xs tracking-widest text-gold uppercase hover:text-gold-bright transition-colors"
            >
              {threadExpanded
                ? 'Hide thread'
                : `Show thread (${threadTweets.length})`}
            </button>
            {threadExpanded && (
              <div className="mt-2 flex flex-col gap-2 border-l-2 border-gold/20 pl-3">
                {threadTweets.map((t, i) => (
                  <p key={i} className="text-sm leading-relaxed text-mist">
                    {t.content}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — byline + actions */}
      <div className="flex items-center justify-between border-t border-seam px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-xs text-shadow">
          <span className="text-mist">
            {tweet.author_name ?? `@${tweet.author_handle}`}
          </span>
          {tweet.author_name && <span>@{tweet.author_handle}</span>}
          {displayDate && (
            <>
              <span>&middot;</span>
              <span>{displayDate}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a
            href={tweet.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs tracking-widest text-gold uppercase hover:text-gold-bright transition-colors"
          >
            View &rarr;
          </a>
          {actions}
        </div>
      </div>
    </article>
  );
}
