import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateCollectionMarkdown } from '@/lib/export';
import ExportButtons from '@/components/ExportButtons';
import TweetCard from '@/components/TweetCard';
import MoveTweetButton from '@/components/MoveTweetButton';
import type { Collection, Tweet } from '@/types/database';

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [collectionResult, tweetsResult, collectionsResult] = await Promise.all([
    supabase.from('collections').select('*').eq('id', id).single<Collection>(),
    supabase
      .from('tweets')
      .select('*')
      .eq('collection_id', id)
      .order('captured_at', { ascending: false })
      .returns<Tweet[]>(),
    supabase
      .from('collections')
      .select('id, name')
      .order('name'),
  ]);

  const collection = collectionResult.data;
  const tweets = tweetsResult.data ?? [];
  const allCollections = (collectionsResult.data ?? []) as { id: string; name: string }[];

  if (!collection) {
    notFound();
  }

  const markdown = generateCollectionMarkdown(collection, tweets);
  const filename = `${collection.name.toLowerCase().replace(/\s+/g, '-')}.md`;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to collections
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{collection.name}</h1>
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {collection.type}
          </span>
        </div>
        <ExportButtons markdown={markdown} filename={filename} />
      </div>

      {collection.ai_summary && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Summary</h2>
          <p className="text-sm text-gray-600">{collection.ai_summary}</p>
        </div>
      )}

      {collection.ai_conclusions && collection.ai_conclusions.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Actionable Conclusions</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
            {collection.ai_conclusions.map((conclusion, i) => (
              <li key={i}>{conclusion}</li>
            ))}
          </ul>
        </div>
      )}

      <hr className="my-6 border-gray-200" />

      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Tweets ({tweets.length})
      </h2>

      {tweets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">No tweets in this collection yet.</p>
          <p className="mt-2 text-sm text-gray-400">
            Go to{' '}
            <Link href="/dashboard/tweets" className="font-medium text-blue-600 hover:text-blue-800">
              Recent Tweets
            </Link>
            {' '}and use &ldquo;Move to&hellip;&rdquo; to add tweets here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tweets.map((tweet) => (
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              actions={
                <MoveTweetButton
                  tweetId={tweet.id}
                  currentCollectionId={id}
                  collections={allCollections}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
