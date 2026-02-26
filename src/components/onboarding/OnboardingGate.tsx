'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingModal from './OnboardingModal';

interface Props {
  isPro: boolean;
}

/**
 * Rendered client-side in the dashboard layout.
 * Shows the onboarding modal when onboarding_completed is false,
 * then refreshes the page so Server Components re-fetch profile data.
 */
export default function OnboardingGate({ isPro }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <OnboardingModal
      isPro={isPro}
      onComplete={() => {
        setDone(true);
        router.refresh();
      }}
    />
  );
}
