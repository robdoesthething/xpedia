'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * Shown after Stripe redirects back to /dashboard?upgraded=true.
 * Auto-dismisses after 6 seconds and cleans the URL.
 */
export default function UpgradeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setVisible(true);
      // Clean the query param from the URL without a hard reload
      router.replace(pathname, { scroll: false });
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    }
  }, [searchParams, router, pathname]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gold text-void font-mono text-sm tracking-wide px-6 py-3 shadow-lg">
      ✦ You&apos;re now on Pro — all features unlocked!
    </div>
  );
}
