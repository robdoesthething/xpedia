'use client';

import { useState } from 'react';
import ProUpgradeModal from './ProUpgradeModal';

interface Props {
  isPro: boolean;
  children: React.ReactNode;
  reason?: 'ai_collection_limit' | 'tweet_count_limit' | 'feature';
}

/**
 * Wraps any UI element that requires Pro. Free users see the element
 * dimmed with a "✦ Pro" badge; clicking opens the upgrade modal.
 */
export default function ProLock({ isPro, children, reason = 'feature' }: Props) {
  const [showModal, setShowModal] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      <div
        className="relative cursor-pointer"
        onClick={() => setShowModal(true)}
        title="Upgrade to Pro"
      >
        <div className="opacity-40 pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs bg-ink border border-gold/50 text-gold px-2 py-0.5">
            ✦ Pro
          </span>
        </div>
      </div>
      {showModal && (
        <ProUpgradeModal reason={reason} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
