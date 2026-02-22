import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CollectionCard from '@/components/CollectionCard';
import ThemeActions from '@/components/ThemeActions';
import ThemeSynthesisPanel from '@/components/ThemeSynthesisPanel';
import type { Collection, Theme, ThemeDigest } from '@/types/database';

export default async function ThemeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [themeRes, collectionsRes, digestsRes] = await Promise.all([
    supabase.from('themes').select('*').eq('id', id).eq('user_id', user.id).single<Theme>(),
    supabase.from('collections')
      .select('*, themes(id, name, created_at, updated_at)')
      .eq('theme_id', id)
      .eq('user_id', user.id)
      .order('name')
      .returns<(Collection & { themes: Theme | null })[]>(),
    supabase.from('theme_digests').select('*')
      .eq('theme_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<ThemeDigest[]>(),
  ]);

  if (!themeRes.data) notFound();

  const theme = themeRes.data;
  const collections = collectionsRes.data ?? [];
  const digests = digestsRes.data ?? [];

  const totalTweets = collections.reduce((sum, c) => sum + (c.tweet_count ?? 0), 0);
  const newTweetCount = theme.last_tweet_count !== null
    ? Math.max(0, totalTweets - theme.last_tweet_count)
    : totalTweets;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors"
      >
        &larr; Collections
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <h1 className="font-serif text-4xl text-parchment">{theme.name}</h1>
        <ThemeActions themeId={id} initialName={theme.name} />
      </div>

      {collections.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {collections.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      ) : (
        <p className="mb-12 text-sm text-shadow">No collections in this theme yet.</p>
      )}

      <ThemeSynthesisPanel
        themeId={id}
        theme={theme}
        digests={digests}
        newTweetCount={newTweetCount}
      />
    </div>
  );
}
