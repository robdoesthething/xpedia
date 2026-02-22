'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AssignThemesButton({ count }: { count: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/collections/assign-themes', { method: 'POST' });
      const data = await res.json();
      console.log(`[Themes] Assigned ${data.assigned} collections to themes`);
      router.refresh();
    } catch (err) {
      console.error('[Themes] Failed to assign themes:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors disabled:opacity-40"
    >
      {loading ? 'Organising…' : `Organise ${count} into themes`}
    </button>
  );
}
