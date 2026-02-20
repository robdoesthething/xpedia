import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface AuthorRow {
  author_handle: string;
  author_name: string | null;
  collection_id: string | null;
}

interface CollectionRow {
  id: string;
  name: string;
}

interface AuthorInfo {
  handle: string;
  name: string | null;
  tweetCount: number;
  topCollectionId: string | null;
  topCollectionName: string | null;
}

export default async function UsersPage() {
  const supabase = await createClient();

  const [tweetsResult, collectionsResult] = await Promise.all([
    supabase
      .from('tweets')
      .select('author_handle, author_name, collection_id'),
    supabase
      .from('collections')
      .select('id, name'),
  ]);

  const tweets = (tweetsResult.data ?? []) as AuthorRow[];
  const collections = (collectionsResult.data ?? []) as CollectionRow[];

  if (tweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-3xl text-parchment">No users yet</h2>
        <p className="mt-3 max-w-md text-sm text-mist">
          Capture tweets to see the authors here, grouped by topic.
        </p>
      </div>
    );
  }

  const collectionMap = new Map(collections.map((c) => [c.id, c.name]));

  const authorMap = new Map<string, {
    name: string | null;
    total: number;
    collectionCounts: Map<string, number>;
  }>();

  for (const tweet of tweets) {
    let author = authorMap.get(tweet.author_handle);
    if (!author) {
      author = { name: tweet.author_name, total: 0, collectionCounts: new Map() };
      authorMap.set(tweet.author_handle, author);
    }
    if (tweet.author_name && !author.name) {
      author.name = tweet.author_name;
    }
    author.total++;
    if (tweet.collection_id) {
      author.collectionCounts.set(
        tweet.collection_id,
        (author.collectionCounts.get(tweet.collection_id) ?? 0) + 1
      );
    }
  }

  const authors: AuthorInfo[] = [];
  for (const [handle, data] of authorMap) {
    let topCollectionId: string | null = null;
    let topCount = 0;
    for (const [colId, count] of data.collectionCounts) {
      if (count > topCount) {
        topCount = count;
        topCollectionId = colId;
      }
    }
    authors.push({
      handle,
      name: data.name,
      tweetCount: data.total,
      topCollectionId,
      topCollectionName: topCollectionId ? collectionMap.get(topCollectionId) ?? null : null,
    });
  }

  authors.sort((a, b) => b.tweetCount - a.tweetCount);

  const grouped = new Map<string, AuthorInfo[]>();
  const uncategorizedAuthors: AuthorInfo[] = [];

  for (const author of authors) {
    if (author.topCollectionName) {
      const group = grouped.get(author.topCollectionName) ?? [];
      group.push(author);
      grouped.set(author.topCollectionName, group);
    } else {
      uncategorizedAuthors.push(author);
    }
  }

  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <h2 className="mb-8 font-serif text-3xl text-parchment">
        Users ({authors.length})
      </h2>

      <div className="space-y-8">
        {sortedGroups.map(([collectionName, groupAuthors]) => (
          <section key={collectionName}>
            <h3 className="mb-3 font-mono text-xs tracking-widest text-gold uppercase">
              {collectionName}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groupAuthors.map((author) => (
                <Link
                  key={author.handle}
                  href={`/dashboard/users/${encodeURIComponent(author.handle)}`}
                  className="flex items-center justify-between border border-seam bg-ink px-4 py-3 transition-colors hover:border-gold/40 hover:bg-quill"
                >
                  <div>
                    <span className="text-sm text-parchment">
                      {author.name ?? `@${author.handle}`}
                    </span>
                    {author.name && (
                      <span className="ml-2 font-mono text-xs text-shadow">@{author.handle}</span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-shadow">
                    {author.tweetCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {uncategorizedAuthors.length > 0 && (
          <section>
            <h3 className="mb-3 font-mono text-xs tracking-widest text-shadow uppercase">
              Uncategorized
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {uncategorizedAuthors.map((author) => (
                <Link
                  key={author.handle}
                  href={`/dashboard/users/${encodeURIComponent(author.handle)}`}
                  className="flex items-center justify-between border border-seam bg-ink px-4 py-3 transition-colors hover:border-gold/40 hover:bg-quill"
                >
                  <div>
                    <span className="text-sm text-parchment">
                      {author.name ?? `@${author.handle}`}
                    </span>
                    {author.name && (
                      <span className="ml-2 font-mono text-xs text-shadow">@{author.handle}</span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-shadow">
                    {author.tweetCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
