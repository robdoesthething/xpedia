import { createClient } from '@/lib/supabase/server';
import CollectionCard from '@/components/CollectionCard';
import NewCollectionButton from '@/components/NewCollectionButton';
import type { Collection, Theme } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from('collections')
    .select('*, themes(id, name, created_at, updated_at)')
    .order('name')
    .returns<(Collection & { themes: Theme | null })[]>();

  const allCollections = collections ?? [];

  if (allCollections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-3xl text-parchment">No collections yet</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">
          Install the Chrome extension and capture your first bookmarks. They&apos;ll be
          automatically organized into collections here.
        </p>
        <div className="mt-8">
          <NewCollectionButton />
        </div>
      </div>
    );
  }

  // Group by theme
  const themeMap = new Map<string, { theme: Theme; collections: Collection[] }>();
  const uncategorized: Collection[] = [];

  for (const col of allCollections) {
    const theme = (col as Collection & { themes: Theme | null }).themes;
    if (theme && col.theme_id) {
      if (!themeMap.has(theme.id)) {
        themeMap.set(theme.id, { theme, collections: [] });
      }
      themeMap.get(theme.id)!.collections.push(col);
    } else {
      uncategorized.push(col);
    }
  }

  const groups = Array.from(themeMap.values()).sort((a, b) =>
    a.theme.name.localeCompare(b.theme.name)
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-serif text-3xl text-parchment">Your Knowledge</h2>
        <NewCollectionButton />
      </div>

      {groups.map(({ theme, collections }) => (
        <section key={theme.id} className="mb-10">
          <h3 className="mb-4 font-mono text-xs tracking-widest text-mist uppercase border-b border-seam pb-2">
            {theme.name}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        </section>
      ))}

      {uncategorized.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-4 font-mono text-xs tracking-widest text-shadow uppercase border-b border-seam pb-2">
            Uncategorized
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uncategorized.map((col) => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
