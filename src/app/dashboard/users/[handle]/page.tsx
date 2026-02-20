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
        className="mb-6 inline-flex items-center font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors"
      >
        &larr; Users
      </Link>

      <h1 className="mb-1 font-serif text-4xl text-parchment">
        {authorName ?? `@${decodedHandle}`}
      </h1>
      {authorName && (
        <p className="mb-2 font-mono text-xs text-shadow">@{decodedHandle}</p>
      )}

      <p className="mb-8 font-mono text-xs text-shadow">
        {tweetList.length} saved {tweetList.length === 1 ? 'item' : 'items'}
      </p>

      {tweetList.length === 0 ? (
        <p className="text-sm text-mist">No items saved from this user.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {tweetList.map((tweet) => (
            <div key={tweet.id}>
              {tweet.collections?.name && (
                <span className="mb-1 inline-block font-mono text-xs tracking-widest text-gold uppercase">
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
