import { createClient } from '@/lib/supabase/server';
import TweetListWithMove from '@/components/TweetListWithMove';
import CategorizeButton from '@/components/CategorizeButton';
import SourcesFilter from '@/components/SourcesFilter';
import type { Tweet } from '@/types/database';

export default async function TweetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  const [allTweetsResult, uncategorizedCountResult, collectionsResult] = await Promise.all([
    supabase
      .from('tweets')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(100)
      .returns<Tweet[]>(),
    supabase
      .from('tweets')
      .select('id', { count: 'exact', head: true })
      .is('collection_id', null),
    supabase.from('collections').select('id, name').order('name'),
  ]);

  const allTweets = allTweetsResult.data ?? [];
  const uncategorizedCount = uncategorizedCountResult.count ?? 0;
  const collections = (collectionsResult.data ?? []) as { id: string; name: string }[];

  // Apply filter
  let tweets = allTweets;
  if (filter === 'uncategorized') {
    tweets = allTweets.filter((t) => !t.collection_id);
  } else if (filter && filter !== 'all') {
    tweets = allTweets.filter((t) => t.collection_id === filter);
  }

  if (allTweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-3xl text-parchment">No sources yet</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">
          Install the Chrome extension, sign in, and visit your X bookmarks page to capture tweets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-serif text-3xl text-parchment">Sources ({allTweets.length})</h2>
        {uncategorizedCount > 0 && <CategorizeButton tweetCount={uncategorizedCount} />}
      </div>
      <SourcesFilter
        collections={collections}
        uncategorizedCount={uncategorizedCount}
        totalCount={allTweets.length}
      />
      <TweetListWithMove tweets={tweets} collections={collections} />
    </div>
  );
}
