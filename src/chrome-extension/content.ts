interface CapturedTweet {
  tweet_url: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  tweet_date: string | null;
}

function parseTweetsFromDOM(): CapturedTweet[] {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets: CapturedTweet[] = [];

  articles.forEach((article) => {
    try {
      const tweet = parseSingleTweet(article as HTMLElement);
      if (tweet) tweets.push(tweet);
    } catch {
      // Skip broken elements — don't stop extraction
    }
  });

  return tweets;
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
        author_handle = text.slice(1);
      } else if (text && !author_name) {
        author_name = text;
      }
    }
  }

  if (!author_handle) return null;

  return { tweet_url, author_handle, author_name, content, tweet_date };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function extractAndSend() {
  const tweets = parseTweetsFromDOM();
  if (tweets.length === 0) return;

  chrome.runtime.sendMessage({ type: 'TWEETS_EXTRACTED', tweets });
}

// Parse tweets visible on initial load
extractAndSend();

// Watch for new tweets loaded by infinite scroll
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(extractAndSend, 500);
});

observer.observe(document.body, { childList: true, subtree: true });
