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
      className="block border border-seam bg-ink p-5 transition-colors hover:border-gold/40 hover:bg-quill"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-lg leading-snug text-parchment">{collection.name}</h3>
        <span className="shrink-0 font-mono text-xs tracking-widest text-shadow uppercase mt-1">
          {collection.type}
        </span>
      </div>

      {(collection.description ?? collection.ai_summary) && (
        <p className="mt-2 text-sm leading-relaxed text-mist line-clamp-2">
          {collection.description ?? collection.ai_summary}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between font-mono text-xs text-shadow">
        <span>
          {collection.tweet_count} {collection.tweet_count === 1 ? 'item' : 'items'}
        </span>
        <span>{formatDate(collection.updated_at)}</span>
      </div>
    </Link>
  );
}
