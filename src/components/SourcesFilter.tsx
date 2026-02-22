'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
  collections: { id: string; name: string }[];
  uncategorizedCount: number;
  totalCount: number;
}

export default function SourcesFilter({ collections, uncategorizedCount, totalCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get('filter') ?? 'all';

  function setFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const tabs = [
    { key: 'all', label: `All (${totalCount})` },
    { key: 'uncategorized', label: `Uncategorized (${uncategorizedCount})` },
    ...collections.map((c) => ({ key: c.id, label: c.name })),
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setFilter(tab.key)}
          className={`font-mono text-xs tracking-widest uppercase px-3 py-1.5 border transition-colors ${
            active === tab.key
              ? 'border-gold text-gold'
              : 'border-seam text-shadow hover:border-gold/40 hover:text-mist'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
