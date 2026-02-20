import { API_BASE } from './config.js';

export interface ThreadTweet {
  author_handle: string;
  content: string;
  position: number;
}

export interface CapturedTweet {
  tweet_url: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  tweet_date: string | null;
  content_type?: 'tweet' | 'thread' | 'article';
  image_urls?: string[];
  article_url?: string | null;
  thread_content?: ThreadTweet[];
}

export async function fetchSavedUrls(token: string): Promise<string[]> {
  // Pass token as query param (not Authorization header) so this GET is a
  // "simple" CORS request with no custom headers — avoids preflight entirely.
  const res = await fetch(
    `${API_BASE}/api/tweets/urls?access_token=${encodeURIComponent(token)}`
  );

  if (!res.ok) return [];

  const data: { urls: string[] } = await res.json();
  return data.urls;
}

export async function sendTweets(
  token: string,
  tweets: CapturedTweet[]
): Promise<{ saved: number; duplicates: number }> {
  const res = await fetch(`${API_BASE}/api/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tweets }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
