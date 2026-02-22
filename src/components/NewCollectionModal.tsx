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
  const [themeId, setThemeId] = useState<string | null>(null);
  const [themes, setThemes] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch('/api/themes')
      .then((r) => r.json())
      .then((data) => setThemes(data.themes ?? []))
      .catch(() => {});
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
      body: JSON.stringify({ name: name.trim(), type, theme_id: themeId }),
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
      <div className="absolute inset-0 bg-void/80" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-ink border border-seam p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 font-mono text-xs text-shadow hover:text-parchment transition-colors"
        >
          &times;
        </button>

        <h2 className="mb-6 font-serif text-2xl text-parchment">New Collection</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="collection-name" className="block font-mono text-xs tracking-widest text-mist uppercase mb-2">
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
              className="w-full bg-void border border-seam px-4 py-3 text-sm text-parchment placeholder:text-shadow focus:border-gold focus:outline-none transition-colors"
              placeholder="e.g. Side Project Ideas"
            />
          </div>

          <fieldset>
            <legend className="block font-mono text-xs tracking-widest text-mist uppercase mb-2">Type</legend>
            <div className="flex gap-6">
              {(['topic', 'project'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 font-mono text-xs tracking-widest text-mist uppercase cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="accent-gold"
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>

          {themes.length > 0 && (
            <div>
              <label htmlFor="collection-theme" className="block font-mono text-xs tracking-widest text-mist uppercase mb-2">
                Theme <span className="text-shadow normal-case tracking-normal">(optional)</span>
              </label>
              <select
                id="collection-theme"
                value={themeId ?? ''}
                onChange={(e) => setThemeId(e.target.value || null)}
                className="w-full bg-void border border-seam px-4 py-3 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
              >
                <option value="">No theme</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="font-mono text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-gold text-void font-mono text-sm tracking-widest uppercase px-4 py-3 hover:bg-gold-bright transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Collection →'}
          </button>
        </form>
      </div>
    </div>
  );
}
