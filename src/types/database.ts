export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  onboarding_completed: boolean;
  ai_collection_id: string | null;
  created_at: string;
}

export interface Theme {
  id: string;
  user_id: string;
  name: string;
  ai_insights: string[] | null;
  ai_key_people: { handle: string; reason: string }[] | null;
  synthesis_updated_at: string | null;
  last_tweet_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  type: 'topic' | 'project';
  description: string | null;
  ai_summary: string | null;
  ai_conclusions: string[] | null;
  ai_key_people: { handle: string; reason: string }[] | null;
  ai_topics: string[] | null;
  summary_updated_at: string | null;
  tweet_count: number;
  theme_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tweet {
  id: string;
  user_id: string;
  collection_id: string | null;
  tweet_url: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  content_type: 'tweet' | 'thread' | 'article';
  thread_content: ThreadTweet[] | null;
  image_urls: string[];
  article_url: string | null;
  article_title: string | null;
  article_description: string | null;
  article_body: string | null;
  ai_summary: string | null;
  ai_topic: string | null;
  extracted_content: string | null;
  tweet_date: string | null;
  captured_at: string;
}

export interface ThreadTweet {
  author_handle: string;
  content: string;
  position: number;
}

/** Shape sent by the Chrome extension when capturing tweets. */
export interface CapturedTweet {
  tweet_url: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  tweet_date: string | null;
  content_type?: 'tweet' | 'thread' | 'article';
  image_urls?: string[];
  article_url?: string | null;
  article_title?: string | null;
  article_description?: string | null;
  thread_content?: ThreadTweet[];
}

export interface ThemeDigest {
  id: string;
  theme_id: string;
  user_id: string;
  tweet_count: number;
  kta: string[];
  new_voices: { handle: string; reason: string }[];
  created_at: string;
}
