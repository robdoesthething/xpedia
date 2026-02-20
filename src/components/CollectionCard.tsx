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
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-gray-900">{collection.name}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {collection.type}
        </span>
      </div>
      {collection.description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{collection.description}</p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>
          {collection.tweet_count} {collection.tweet_count === 1 ? 'tweet' : 'tweets'}
        </span>
        <span>Updated {formatDate(collection.updated_at)}</span>
      </div>
    </Link>
  );
}
