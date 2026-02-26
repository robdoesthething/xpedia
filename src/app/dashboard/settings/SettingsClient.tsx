'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsClient() {
  const router = useRouter();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await fetch('/api/corpus/reset', { method: 'POST' });
    } finally {
      setResetting(false);
    }
    setShowResetConfirm(false);
    // Onboarding modal will show automatically after redirect (onboarding_completed = false)
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <>
      {/* Corpus / Danger Zone */}
      <section className="border border-red-900/40 p-6">
        <h3 className="mb-1 font-mono text-xs tracking-widest text-red-400 uppercase">
          Danger Zone
        </h3>
        <p className="mb-6 text-sm text-mist leading-relaxed">
          These actions are permanent. Your captured tweets are <span className="text-parchment">never deleted</span> — only themes and collections are affected.
        </p>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="border border-red-900/50 text-red-400 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-red-700 hover:text-red-300 transition-colors"
        >
          Reset corpus
        </button>
      </section>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-void/80" onClick={() => setShowResetConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm bg-ink border border-seam p-8 shadow-2xl">
            <h3 className="font-serif text-xl text-parchment mb-3">Reset your corpus?</h3>
            <p className="text-sm text-mist leading-relaxed mb-2">
              All themes and collections will be permanently deleted.
            </p>
            <p className="text-sm text-mist leading-relaxed mb-8">
              Your tweets are kept but become uncategorized. You&apos;ll be taken back through onboarding to rebuild your taxonomy.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 border border-seam text-mist font-mono text-xs tracking-widest uppercase py-2 hover:text-parchment hover:border-parchment/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 bg-red-700 text-parchment font-mono text-xs tracking-widest uppercase py-2 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
