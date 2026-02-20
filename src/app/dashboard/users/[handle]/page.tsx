import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TweetCard from '@/components/TweetCard';
import type { Tweet } from '@/types/database';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const decodedHandle = decodeURIComponent(handle);
  const supabase = await createClient();

  const { data: tweets } = await supabase
    .from('tweets')
    .select('*, collections(name)')
    .eq('author_handle', decodedHandle)
    .order('captured_at', { ascending: false })
    .returns<(Tweet & { collections: { name: string } | null })[]>();

  const tweetList = tweets ?? [];
  const authorName = tweetList.find((t) => t.author_name)?.author_name;

  return (
    <div>
      <Link
        href="/dashboard/users"
        className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to users
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        {authorName ?? `@${decodedHandle}`}
      </h1>
      {authorName && (
        <p className="mb-6 text-sm text-gray-500">@{decodedHandle}</p>
      )}

      <p className="mb-6 text-sm text-gray-500">
        {tweetList.length} saved {tweetList.length === 1 ? 'tweet' : 'tweets'}
      </p>

      {tweetList.length === 0 ? (
        <p className="text-sm text-gray-500">No tweets saved from this user.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {tweetList.map((tweet) => (
            <div key={tweet.id}>
              {tweet.collections?.name && (
                <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {tweet.collections.name}
                </span>
              )}
              <TweetCard tweet={tweet} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
