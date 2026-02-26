import { createClient } from '@/lib/supabase/server';
import InboxClient from './InboxClient';
import type { Collection } from '@/types/database';

export default async function InboxPage() {
  const supabase = await createClient();

  const [tweetsRes, collectionsRes] = await Promise.all([
    supabase
      .from('tweets')
      .select('id, content, author_handle, tweet_url, tweet_date, ai_summary')
      .is('collection_id', null)
      .order('captured_at', { ascending: false })
      .limit(100),
    supabase
      .from('collections')
      .select('id, name, theme_id')
      .order('name')
      .returns<Collection[]>(),
  ]);

  if (tweetsRes.error) console.error('[DB] Failed to fetch uncategorized tweets:', tweetsRes.error.message);
  if (collectionsRes.error) console.error('[DB] Failed to fetch collections:', collectionsRes.error.message);

  const tweets = tweetsRes.data ?? [];
  const collections = collectionsRes.data ?? [];

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-serif text-3xl text-parchment">Inbox</h2>
        <p className="mt-2 text-sm text-mist">
          {tweets.length} uncategorized tweet{tweets.length !== 1 ? 's' : ''} — assign each to a collection or let AI sort them.
        </p>
      </div>
      <InboxClient tweets={tweets} collections={collections} />
    </div>
  );
}
