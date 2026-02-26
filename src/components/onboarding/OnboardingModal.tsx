'use client';

import { useState } from 'react';
import WelcomeStep from './steps/WelcomeStep';
import ExtensionStep from './steps/ExtensionStep';
import TaxonomyStep from './steps/TaxonomyStep';
import AiSlotStep from './steps/AiSlotStep';

interface Props {
  isPro: boolean;
  onComplete: () => void;
}

export default function OnboardingModal({ isPro, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

  // Pro: 3 steps (no AI slot step); Free: 4 steps
  const totalSteps = isPro ? 3 : 4;

  async function handleTaxonomyConfirm(themes: string[]) {
    setTaxonomyLoading(true);
    try {
      await Promise.all(
        themes.map((name) =>
          fetch('/api/themes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
        )
      );
    } finally {
      setTaxonomyLoading(false);
    }
    isPro ? handleComplete() : setStep(4);
  }

  async function handleComplete() {
    setCompleteLoading(true);
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' });
    } finally {
      setCompleteLoading(false);
    }
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-void/80" />
      <div className="relative z-10 w-full max-w-lg bg-ink border border-seam p-8 shadow-2xl">
        {/* Progress bar */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 transition-colors ${i + 1 <= step ? 'bg-gold' : 'bg-seam'}`}
            />
          ))}
        </div>

        {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
        {step === 2 && <ExtensionStep onNext={() => setStep(3)} />}
        {step === 3 && (
          <TaxonomyStep isPro={isPro} onConfirm={handleTaxonomyConfirm} loading={taxonomyLoading} />
        )}
        {step === 4 && !isPro && (
          <AiSlotStep onComplete={handleComplete} loading={completeLoading} />
        )}
      </div>
    </div>
  );
}
