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
        className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors disabled:opacity-50"
      >
        {loading ? 'Moving...' : 'Move to...'}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 border border-seam bg-ink shadow-xl">
          {currentCollectionId && (
            <button
              onClick={() => moveTo(null)}
              className="block w-full px-3 py-2 text-left font-mono text-xs text-mist hover:bg-quill transition-colors"
            >
              Uncategorized
            </button>
          )}
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => moveTo(c.id)}
              className="block w-full border-t border-seam px-3 py-2 text-left font-mono text-xs text-mist hover:bg-quill transition-colors first:border-0"
            >
              {c.name}
            </button>
          ))}
          {options.length === 0 && !currentCollectionId && (
            <p className="px-3 py-2 font-mono text-xs text-shadow">No collections available</p>
          )}
        </div>
      )}
    </div>
  );
}
