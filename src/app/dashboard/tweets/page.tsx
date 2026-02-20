import { createClient } from '@/lib/supabase/server';
import TweetListWithMove from '@/components/TweetListWithMove';
import CategorizeButton from '@/components/CategorizeButton';
import type { Tweet } from '@/types/database';

export default async function TweetsPage() {
  const supabase = await createClient();

  const [tweetsResult, collectionsResult] = await Promise.all([
    supabase
      .from('tweets')
      .select('*')
      .is('collection_id', null)
      .order('captured_at', { ascending: false })
      .limit(50)
      .returns<Tweet[]>(),
    supabase
      .from('collections')
      .select('id, name')
      .order('name'),
  ]);

  const tweets = tweetsResult.data ?? [];
  const collections = (collectionsResult.data ?? []) as { id: string; name: string }[];

  if (tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-3xl text-parchment">No items captured yet</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">
          Install the Chrome extension, sign in, and visit your X bookmarks page to capture tweets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-serif text-3xl text-parchment">
          Uncategorized Items ({tweets.length})
        </h2>
        <CategorizeButton tweetCount={tweets.length} />
      </div>
      <TweetListWithMove tweets={tweets} collections={collections} />
    </div>
  );
}
