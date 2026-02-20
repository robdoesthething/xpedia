import type { CapturedTweet, ThreadTweet } from './api.js';

export function parseTweetsFromDOM(): CapturedTweet[] {
  const articles = Array.from(
    document.querySelectorAll('article[data-testid="tweet"]')
  ) as HTMLElement[];

  return groupThreadsFromArticles(articles);
}

function parseSingleTweet(article: HTMLElement): CapturedTweet | null {
  // Tweet text
  const textEl = article.querySelector('[data-testid="tweetText"]');
  const content = textEl?.textContent?.trim();
  if (!content) return null;

  // Tweet URL — find the permalink near the <time> element
  const timeEl = article.querySelector('time[datetime]');
  const permalink = timeEl?.closest('a');
  const href = permalink?.getAttribute('href');
  if (!href || !href.includes('/status/')) return null;
  const tweet_url = `https://x.com${href}`;

  // Tweet date
  const tweet_date = timeEl?.getAttribute('datetime') ?? null;

  // Author — extract from User-Name area
  const userNameEl = article.querySelector('[data-testid="User-Name"]');
  let author_handle = '';
  let author_name: string | null = null;

  if (userNameEl) {
    const links = userNameEl.querySelectorAll('a');
    for (const link of links) {
      const text = link.textContent?.trim() ?? '';
      if (text.startsWith('@')) {
        author_handle = text.slice(1); // Remove @
      } else if (text && !author_name) {
        author_name = text;
      }
    }
  }

  if (!author_handle) return null;

  // Image URLs — filter to pbs.twimg.com (actual tweet photos, not avatars)
  const image_urls = Array.from(
    article.querySelectorAll('[data-testid="tweetPhoto"] img')
  )
    .map((img) => (img as HTMLImageElement).src)
    .filter((src) => src.includes('pbs.twimg.com'));

  // Article URL — external link from the card wrapper, not x.com
  const cardLink = article.querySelector('[data-testid="card.wrapper"] a[href]');
  const rawArticleHref = cardLink?.getAttribute('href') ?? null;
  const article_url =
    rawArticleHref && !rawArticleHref.includes('x.com') && !rawArticleHref.includes('twitter.com')
      ? rawArticleHref
      : null;

  const content_type: 'tweet' | 'article' = article_url ? 'article' : 'tweet';

  return {
    tweet_url,
    author_handle,
    author_name,
    content,
    tweet_date,
    content_type,
    image_urls: image_urls.length > 0 ? image_urls : undefined,
    article_url,
  };
}

/**
 * Walk articles in DOM order, detect thread sequences, and stitch them
 * into a single CapturedTweet with content_type 'thread'.
 */
function groupThreadsFromArticles(articles: HTMLElement[]): CapturedTweet[] {
  const result: CapturedTweet[] = [];
  let i = 0;

  while (i < articles.length) {
    const article = articles[i];
    const tweet = parseSingleTweet(article);

    if (!tweet) {
      i++;
      continue;
    }

    // Check if this article starts a thread
    if (isThreadStart(article)) {
      const threadTweets: ThreadTweet[] = [
        { author_handle: tweet.author_handle, content: tweet.content, position: 0 },
      ];

      let j = i + 1;
      while (j < articles.length) {
        const nextArticle = articles[j];
        const nextTweet = parseSingleTweet(nextArticle);

        if (!nextTweet || nextTweet.author_handle !== tweet.author_handle) break;
        if (!isThreadContinuation(nextArticle)) break;

        threadTweets.push({
          author_handle: nextTweet.author_handle,
          content: nextTweet.content,
          position: threadTweets.length,
        });
        j++;
      }

      if (threadTweets.length > 1) {
        result.push({
          ...tweet,
          content_type: 'thread',
          thread_content: threadTweets,
        });
        i = j;
        continue;
      }
    }

    result.push(tweet);
    i++;
  }

  return result;
}

/** Returns true if this article has a "Show this thread" link — reliable thread signal. */
function isThreadStart(article: HTMLElement): boolean {
  const links = article.querySelectorAll('a');
  for (const link of links) {
    if (link.textContent?.trim().toLowerCase() === 'show this thread') return true;
  }
  // Also check for a thread connector line below the avatar (vertical bar)
  const connectorLine = article.querySelector(
    '[data-testid="tweet-user-avatar-container"] div[style*="width: 2px"]'
  );
  return connectorLine !== null;
}

/** Returns true if this article is visually connected to the previous one (continuation). */
function isThreadContinuation(article: HTMLElement): boolean {
  const connectorLine = article.querySelector(
    '[data-testid="tweet-user-avatar-container"] div[style*="width: 2px"]'
  );
  return connectorLine !== null;
}
