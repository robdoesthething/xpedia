import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateCollectionMarkdown } from '@/lib/export';
import ExportButtons from '@/components/ExportButtons';
import CollectionActions from '@/components/CollectionActions';
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
        className="mb-6 inline-flex items-center font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors"
      >
        &larr; Collections
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-4xl text-parchment">{collection.name}</h1>
          <span className="mt-2 inline-block font-mono text-xs tracking-widest text-shadow uppercase">
            {collection.type}
          </span>
          <div className="mt-4">
            <CollectionActions
              collectionId={collection.id}
              initialName={collection.name}
              initialType={collection.type}
            />
          </div>
        </div>
        <ExportButtons markdown={markdown} filename={filename} />
      </div>

      {collection.ai_summary && (
        <div className="mb-6 border border-seam bg-ink p-5">
          <h2 className="mb-3 font-mono text-xs tracking-widest text-gold uppercase">Summary</h2>
          <p className="text-sm leading-relaxed text-mist">{collection.ai_summary}</p>
        </div>
      )}

      {collection.ai_conclusions && collection.ai_conclusions.length > 0 && (
        <div className="mb-6 border border-seam bg-ink p-5">
          <h2 className="mb-3 font-mono text-xs tracking-widest text-gold uppercase">Actionable Conclusions</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-mist">
            {collection.ai_conclusions.map((conclusion, i) => (
              <li key={i}>{conclusion}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="my-8 border-t border-seam" />

      <h2 className="mb-4 font-mono text-xs tracking-widest text-shadow uppercase">
        Items ({tweets.length})
      </h2>

      {tweets.length === 0 ? (
        <div className="border border-dashed border-seam p-8 text-center">
          <p className="text-sm text-mist">No items in this collection yet.</p>
          <p className="mt-2 text-sm text-shadow">
            Go to{' '}
            <Link href="/dashboard/tweets" className="font-medium text-gold hover:text-gold-bright transition-colors">
              Uncategorized
            </Link>
            {' '}and use &ldquo;Move to&hellip;&rdquo; to add items here.
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
