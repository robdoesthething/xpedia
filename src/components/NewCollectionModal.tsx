'use client';

import { useState, useEffect, useRef } from 'react';

export default function NewCollectionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'topic' | 'project'>('project');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Failed to create collection');
      setLoading(false);
      return;
    }

    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
        >
          &times;
        </button>

        <h2 className="mb-4 text-lg font-semibold text-stone-900">New Collection</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="collection-name" className="block text-sm font-medium text-stone-700">
              Name
            </label>
            <input
              ref={inputRef}
              id="collection-name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. Side Project Ideas"
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-stone-700">Type</legend>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="type"
                  value="topic"
                  checked={type === 'topic'}
                  onChange={() => setType('topic')}
                  className="text-amber-500 focus:ring-amber-400"
                />
                Topic
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="type"
                  value="project"
                  checked={type === 'project'}
                  onChange={() => setType('project')}
                  className="text-amber-500 focus:ring-amber-400"
                />
                Project
              </label>
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Collection'}
          </button>
        </form>
      </div>
    </div>
  );
}
