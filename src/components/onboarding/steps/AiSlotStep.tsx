'use client';

import { useState } from 'react';

interface Props {
  onComplete: () => void;
  loading?: boolean;
}

export default function AiSlotStep({ onComplete, loading = false }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl text-parchment">Your free AI collection</h2>
        <p className="mt-2 text-sm text-mist leading-relaxed">
          Free plan includes AI synthesis (summaries + conclusions) for <span className="text-parchment">one collection</span> with up
          to <span className="text-parchment">5 tweets</span>.
        </p>
        <p className="mt-2 text-sm text-mist leading-relaxed">
          AI will automatically assign it when you first run synthesis. Upgrade to Pro for unlimited AI on all collections.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 accent-gold"
        />
        <span className="text-sm text-mist">Got it — I&apos;ll pick my AI collection when I first run synthesis</span>
      </label>

      <button
        type="button"
        disabled={!acknowledged || loading}
        onClick={onComplete}
        className="w-full bg-gold text-void font-mono text-sm tracking-widest uppercase px-4 py-3 hover:bg-gold/90 transition-colors disabled:opacity-40"
      >
        {loading ? 'Finishing...' : 'Start building →'}
      </button>
    </div>
  );
}
