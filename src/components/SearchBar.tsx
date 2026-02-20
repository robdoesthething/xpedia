'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  author_handle: string;
  content: string;
  tweet_url: string;
  collection_id: string | null;
  collections: { name: string } | null;
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const data = await res.json();
    setResults(data.results ?? []);
    setOpen(true);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  }

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery('');
    if (result.collection_id) {
      router.push(`/dashboard/collection/${result.collection_id}`);
    } else {
      router.push('/dashboard/tweets');
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search..."
        className="w-full bg-void border border-seam px-3 py-2 font-mono text-xs text-parchment placeholder:text-shadow focus:border-gold focus:outline-none transition-colors"
      />

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full border border-seam bg-ink shadow-xl">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="flex w-full flex-col gap-1 border-b border-seam px-3 py-2 text-left last:border-0 hover:bg-quill transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-mist">
                  @{result.author_handle}
                </span>
                {result.collections?.name && (
                  <span className="font-mono text-xs text-shadow border border-seam px-2 py-0.5">
                    {result.collections.name}
                  </span>
                )}
              </div>
              <p className="line-clamp-1 text-xs text-shadow">{result.content}</p>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full border border-seam bg-ink px-3 py-4 text-center font-mono text-xs text-shadow shadow-xl">
          No results found
        </div>
      )}
    </div>
  );
}
