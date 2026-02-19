import { createClient } from '@/lib/supabase/server';
import CollectionCard from '@/components/CollectionCard';
import type { Collection } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from('collections')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<Collection[]>();

  if (!collections || collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No collections yet</h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          Install the Chrome extension and capture your first bookmarks. They&apos;ll be
          automatically organized into collections here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Your Collections</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </div>
  );
}
