'use client';

import { useState } from 'react';

const DEFAULT_CHIPS = [
  'AI & Machine Learning',
  'Startups & Business',
  'Design & Creativity',
  'Programming & Dev Tools',
  'Finance & Investing',
  'Science & Research',
  'Health & Longevity',
  'Productivity & Focus',
  'Marketing & Growth',
  'Writing & Communication',
  'Philosophy & Ideas',
  'Current Events',
];

interface Props {
  isPro: boolean;
  onConfirm: (themes: string[]) => void;
  loading?: boolean;
}

export default function TaxonomyStep({ isPro, onConfirm, loading = false }: Props) {
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  function toggle(chip: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(chip) ? next.delete(chip) : next.add(chip);
      return next;
    });
  }

  function addCustom() {
    const name = custom.trim();
    if (!name || chips.includes(name)) return;
    setChips((prev) => [...prev, name]);
    setSelected((prev) => new Set([...prev, name]));
    setCustom('');
  }

  async function handleAiSuggest() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-categories');
      if (res.ok) {
        const { suggestions } = await res.json();
        if (Array.isArray(suggestions)) {
          setChips((prev) => {
            const combined = [...new Set([...prev, ...suggestions])];
            return combined;
          });
        }
      }
    } catch {
      // silent fail
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl text-parchment">What do you learn about?</h2>
        <p className="mt-2 text-sm text-mist">
          Select the topics you bookmark. AI will classify your tweets into these areas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => toggle(chip)}
            className={`px-3 py-1.5 font-mono text-xs tracking-wide border transition-colors ${
              selected.has(chip)
                ? 'bg-gold text-void border-gold'
                : 'bg-void text-mist border-seam hover:border-parchment/30 hover:text-parchment'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Add your own topic..."
          className="flex-1 bg-void border border-seam px-3 py-2 text-sm text-parchment placeholder:text-shadow focus:border-gold focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-3 py-2 border border-seam text-mist font-mono text-xs hover:text-parchment hover:border-parchment/30 transition-colors"
        >
          Add
        </button>
        {isPro && (
          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={aiLoading}
            className="px-3 py-2 border border-gold/50 text-gold font-mono text-xs hover:bg-gold/10 transition-colors disabled:opacity-50"
          >
            {aiLoading ? '...' : '✦ AI Suggest'}
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={selected.size === 0 || loading}
        onClick={() => onConfirm(Array.from(selected))}
        className="w-full bg-gold text-void font-mono text-sm tracking-widest uppercase px-4 py-3 hover:bg-gold/90 transition-colors disabled:opacity-40"
      >
        {loading ? 'Saving...' : `Continue with ${selected.size} topic${selected.size !== 1 ? 's' : ''} →`}
      </button>
    </div>
  );
}
