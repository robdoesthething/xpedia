'use client';

import { useState, useRef, useEffect } from 'react';

interface CollectionOption {
  id: string;
  name: string;
}

export default function MoveTweetButton({
  tweetId,
  currentCollectionId,
  collections,
  onMoved,
}: {
  tweetId: string;
  currentCollectionId: string | null;
  collections: CollectionOption[];
  onMoved?: (tweetId: string, collectionId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function moveTo(collectionId: string | null) {
    setLoading(true);
    setOpen(false);

    const res = await fetch(`/api/tweets/${tweetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection_id: collectionId }),
    });

    setLoading(false);

    if (res.ok) {
      onMoved?.(tweetId, collectionId);
    }
  }

  const options = collections.filter((c) => c.id !== currentCollectionId);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
      >
        {loading ? 'Moving...' : 'Move to...'}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {currentCollectionId && (
            <button
              onClick={() => moveTo(null)}
              className="block w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
            >
              Uncategorized
            </button>
          )}
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => moveTo(c.id)}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {c.name}
            </button>
          ))}
          {options.length === 0 && !currentCollectionId && (
            <p className="px-3 py-2 text-sm text-gray-400">No collections available</p>
          )}
        </div>
      )}
    </div>
  );
}
