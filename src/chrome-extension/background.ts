import { getToken } from './lib/auth.js';
import { fetchSavedUrls, sendTweets, fetchUncategorizedCount } from './lib/api.js';
import type { CapturedTweet } from './lib/api.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TWEETS_EXTRACTED') {
    handleTweetsExtracted(message.tweets).then(sendResponse);
    return true; // Keep message channel open for async response
  }
});

async function handleTweetsExtracted(tweets: CapturedTweet[]): Promise<{ saved: number }> {
  const token = await getToken();
  if (!token) {
    console.warn('[Xpedia] Not authenticated — skipping capture');
    return { saved: 0 };
  }

  // Client-side dedup: fetch already-saved URLs
  const savedUrls = await fetchSavedUrls(token);
  const savedSet = new Set(savedUrls);
  const newTweets = tweets.filter((t) => !savedSet.has(t.tweet_url));

  if (newTweets.length === 0) {
    const count = await fetchUncategorizedCount(token);
    updateBadge(count);
    return { saved: 0 };
  }

  try {
    const result = await sendTweets(token, newTweets);
    const count = await fetchUncategorizedCount(token);
    updateBadge(count);
    console.log(`[Xpedia] Captured ${result.saved} tweets (${result.duplicates} duplicates)`);
    return { saved: result.saved };
  } catch (err) {
    console.error('[Xpedia] Failed to send tweets:', err);
    return { saved: 0 };
  }
}

function updateBadge(count: number) {
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
}
