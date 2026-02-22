import { parseTweetsFromDOM } from './lib/parser.js';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function extractAndSend() {
  const tweets = parseTweetsFromDOM();
  console.log(`[Xpedia] Parsed ${tweets.length} tweets from DOM`);
  if (tweets.length === 0) return;

  chrome.runtime.sendMessage({ type: 'TWEETS_EXTRACTED', tweets }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Xpedia] Message to service worker failed:', chrome.runtime.lastError.message);
    } else if (response) {
      console.log(`[Xpedia] Service worker saved ${response.saved} tweets`);
    }
  });
}

// Parse tweets visible on initial load
extractAndSend();

// Watch for new tweets loaded by infinite scroll
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(extractAndSend, 500);
});

observer.observe(document.body, { childList: true, subtree: true });
