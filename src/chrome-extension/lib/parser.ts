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

  // Article title and description from card metadata
  let article_title: string | null = null;
  let article_description: string | null = null;

  if (article_url) {
    const cardWrapper = article.querySelector('[data-testid="card.wrapper"]');
    if (cardWrapper) {
      // X renders card text in a detail container — try both layout variants
      const detailEl = cardWrapper.querySelector(
        '[data-testid="card.layoutLarge.detail"], [data-testid="card.layoutSmall.detail"]'
      );
      if (detailEl) {
        // Each text block is a div[dir] or div[dir="auto"] — collect in DOM order
        const textBlocks = Array.from(detailEl.querySelectorAll('div[dir]'))
          .map((el) => el.textContent?.trim() ?? '')
          .filter((t) => t.length > 0);
        if (textBlocks.length >= 1) article_title = textBlocks[0];
        // Second block is description; skip if it looks like a domain (no spaces, contains dot)
        if (textBlocks.length >= 2) {
          const candidate = textBlocks[1];
          article_description = /\s/.test(candidate) ? candidate : null;
          // If candidate looks like domain, check next block
          if (!article_description && textBlocks.length >= 3) {
            article_description = textBlocks[2];
          }
        }
      }
    }
  }

  return {
    tweet_url,
    author_handle,
    author_name,
    content,
    tweet_date,
    content_type,
    image_urls: image_urls.length > 0 ? image_urls : undefined,
    article_url,
    article_title,
    article_description,
  };
}

// ── Thread detection ─────────────────────────────────────────────────────────

/**
 * Walk articles in DOM order, detect thread sequences, and stitch them
 * into a single CapturedTweet with content_type 'thread'.
 *
 * Thread signals (checked in order of reliability):
 * 1. Visual connector line inside the avatar container (timeline/profile views)
 * 2. "Show this thread" link text
 * 3. Self-reply: "Replying to @same_author" (works on bookmarks page)
 * 4. Consecutive same-author tweets (bookmarks fallback)
 */
function groupThreadsFromArticles(articles: HTMLElement[]): CapturedTweet[] {
  // First pass: parse all tweets and annotate with thread signals
  const parsed: { article: HTMLElement; tweet: CapturedTweet | null; isSelfReply: boolean }[] = [];

  for (const article of articles) {
    const tweet = parseSingleTweet(article);
    const selfReply = tweet ? isSelfReply(article, tweet.author_handle) : false;
    parsed.push({ article, tweet, isSelfReply: selfReply });
  }

  // Second pass: group into threads
  const result: CapturedTweet[] = [];
  let i = 0;

  while (i < parsed.length) {
    const { article, tweet, isSelfReply: selfReply } = parsed[i];

    if (!tweet) {
      i++;
      continue;
    }

    // Check if this starts a thread using any signal
    const startsThread = isThreadStart(article) || isPartOfThread(article, tweet);

    if (startsThread) {
      const threadTweets: ThreadTweet[] = [
        { author_handle: tweet.author_handle, content: tweet.content, position: 0 },
      ];

      let j = i + 1;
      while (j < parsed.length) {
        const next = parsed[j];
        if (!next.tweet || next.tweet.author_handle !== tweet.author_handle) break;
        // Accept as continuation if any thread signal fires
        if (!isThreadContinuation(next.article) && !next.isSelfReply && !areConsecutiveSameAuthor(parsed, i, j)) break;

        threadTweets.push({
          author_handle: next.tweet.author_handle,
          content: next.tweet.content,
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

    // Check if this is a self-reply orphan (single bookmarked thread tweet)
    // Mark it as a thread with just one entry so the AI knows it's a thread fragment
    if (selfReply) {
      result.push({
        ...tweet,
        content_type: 'thread',
        thread_content: [{ author_handle: tweet.author_handle, content: tweet.content, position: 0 }],
      });
      i++;
      continue;
    }

    result.push(tweet);
    i++;
  }

  return result;
}

/** Returns true if this article has classic thread-start signals. */
function isThreadStart(article: HTMLElement): boolean {
  if (hasShowThreadLink(article)) return true;
  if (hasThreadConnector(article)) return true;
  return false;
}

/** Returns true if this tweet has bookmarks-compatible thread signals. */
function isPartOfThread(article: HTMLElement, tweet: CapturedTweet): boolean {
  // Self-reply detection — works on bookmarks page
  if (isSelfReply(article, tweet.author_handle)) return true;
  // Thread emoji (🧵) in the content — common manual thread marker
  // X renders emojis as <img alt="🧵">, so check both textContent and alt attributes
  if (tweet.content.includes('🧵')) return true;
  const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
  if (tweetTextEl) {
    const emojiImgs = tweetTextEl.querySelectorAll('img[alt]');
    for (const img of emojiImgs) {
      if (img.getAttribute('alt') === '🧵') return true;
    }
  }
  return false;
}

/** Returns true if this article is visually connected to the previous one (continuation). */
function isThreadContinuation(article: HTMLElement): boolean {
  return hasThreadConnector(article);
}

/**
 * Detect self-reply: X renders "Replying to @username" above the tweet text.
 * On the bookmarks page, this is the most reliable thread signal.
 *
 * The reply indicator can appear as:
 * - A div with data-testid="reply" containing a link to /@handle
 * - Text content matching "Replying to @handle" pattern
 * - A socialContext element referencing the same author
 */
function isSelfReply(article: HTMLElement, authorHandle: string): boolean {
  // Method 1: Look for the reply indicator with data-testid
  const replyEl = article.querySelector('[data-testid="reply"]');
  if (replyEl) {
    const replyText = replyEl.textContent?.toLowerCase() ?? '';
    if (replyText.includes(`@${authorHandle.toLowerCase()}`)) return true;
  }

  // Method 2: Scan all text nodes for "Replying to @handle" pattern
  // X sometimes renders this without a data-testid
  const allText = article.textContent ?? '';
  const replyPattern = new RegExp(`replying to\\s+@${escapeRegex(authorHandle)}`, 'i');
  if (replyPattern.test(allText)) return true;

  // Method 3: Check for socialContext mentioning the same author
  const socialCtx = article.querySelector('[data-testid="socialContext"]');
  if (socialCtx) {
    const ctxText = socialCtx.textContent?.toLowerCase() ?? '';
    if (ctxText.includes(authorHandle.toLowerCase()) && ctxText.includes('thread')) return true;
  }

  return false;
}

/**
 * Check if tweets at positions start and current are from the same author
 * and all tweets between them are also from the same author.
 * Used as a bookmarks fallback when other signals fail.
 */
function areConsecutiveSameAuthor(
  parsed: { tweet: CapturedTweet | null; isSelfReply: boolean }[],
  start: number,
  current: number
): boolean {
  if (current - start > 10) return false; // Cap to avoid false positives on long feeds
  const startTweet = parsed[start]?.tweet;
  if (!startTweet) return false;

  // Only group if at least one tweet in the sequence has a self-reply signal
  let hasSelfReplySignal = parsed[start].isSelfReply;

  for (let k = start + 1; k <= current; k++) {
    const t = parsed[k]?.tweet;
    if (!t || t.author_handle !== startTweet.author_handle) return false;
    if (parsed[k].isSelfReply) hasSelfReplySignal = true;
  }

  return hasSelfReplySignal;
}

/** Check for "Show this thread" link text. */
function hasShowThreadLink(article: HTMLElement): boolean {
  const links = article.querySelectorAll('a');
  for (const link of links) {
    const text = link.textContent?.trim().toLowerCase() ?? '';
    if (text === 'show this thread') return true;
    if (text === 'show more replies') return true;
  }
  // Also check role="button" elements (X sometimes uses these instead)
  const buttons = article.querySelectorAll('[role="button"]');
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase() ?? '';
    if (text === 'show this thread') return true;
  }
  return false;
}

/**
 * Detect X's thread connector line inside the avatar container.
 * X renders this as a narrow vertical bar — a div with ~2px width in inline styles.
 * We match `2px` broadly to handle width/min-width/max-width variants across X releases.
 */
function hasThreadConnector(article: HTMLElement): boolean {
  const avatarContainer = article.querySelector(
    '[data-testid="tweet-user-avatar-container"], [data-testid="Tweet-User-Avatar"]'
  );
  if (!avatarContainer) return false;
  return avatarContainer.querySelector('div[style*="2px"]') !== null;
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
