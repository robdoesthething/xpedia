import { createClient } from '@/lib/supabase/server';
import TweetCard from '@/components/TweetCard';
import type { Tweet } from '@/types/database';

export default async function TweetsPage() {
  const supabase = await createClient();

  const { data: tweets } = await supabase
    .from('tweets')
    .select('*')
    .is('collection_id', null)
    .order('captured_at', { ascending: false })
    .limit(50)
    .returns<Tweet[]>();

  if (!tweets || tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No tweets captured yet</h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          Install the Chrome extension, sign in, and visit your X bookmarks page to capture tweets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Recent Tweets</h2>
      <div className="flex flex-col gap-4">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} />
        ))}
      </div>
    </div>
  );
}
