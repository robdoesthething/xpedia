import { API_BASE } from './config.js';

export interface CapturedTweet {
  tweet_url: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  tweet_date: string | null;
}

export async function fetchSavedUrls(token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/tweets/urls`, {
    headers: { Authorization: `Bearer ${token}` },
  });

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
