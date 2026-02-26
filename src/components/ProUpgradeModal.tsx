'use client';

interface Props {
  onClose: () => void;
  reason?: 'ai_collection_limit' | 'tweet_count_limit' | 'feature';
}

const REASON_TEXT: Record<string, string> = {
  ai_collection_limit: 'Free plan includes AI synthesis for 1 collection. Upgrade to unlock all collections.',
  tweet_count_limit: 'Free plan synthesizes up to 5 tweets per collection. Upgrade for unlimited.',
  feature: 'This feature is available on Pro.',
};

export default function ProUpgradeModal({ onClose, reason = 'feature' }: Props) {
  async function handleUpgrade() {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-void/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-ink border border-seam p-8 text-center shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 font-mono text-xs text-shadow hover:text-parchment transition-colors"
        >
          &times;
        </button>

        <div className="mb-4 text-2xl text-gold">✦</div>
        <h2 className="font-serif text-2xl text-parchment mb-2">Upgrade to Pro</h2>
        <p className="text-sm text-mist mb-8 leading-relaxed">{REASON_TEXT[reason]}</p>

        <button
          onClick={handleUpgrade}
          className="w-full bg-gold text-void font-mono text-sm tracking-widest uppercase px-4 py-3 hover:bg-gold/90 transition-colors mb-3"
        >
          Upgrade — one-time payment
        </button>
        <button
          onClick={onClose}
          className="font-mono text-xs text-shadow hover:text-mist transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
