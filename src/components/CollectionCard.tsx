import Link from 'next/link';
import type { Collection } from '@/types/database';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link
      href={`/dashboard/collection/${collection.id}`}
      className="block rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-amber-300 hover:bg-amber-50/30"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-stone-900">{collection.name}</h3>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
          {collection.type}
        </span>
      </div>

      {(collection.description ?? collection.ai_summary) && (
        <p className="mt-2 text-sm leading-relaxed text-stone-500 line-clamp-2">
          {collection.description ?? collection.ai_summary}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-stone-400">
        <span>
          {collection.tweet_count} {collection.tweet_count === 1 ? 'item' : 'items'}
        </span>
        <span>Updated {formatDate(collection.updated_at)}</span>
      </div>
    </Link>
  );
}
