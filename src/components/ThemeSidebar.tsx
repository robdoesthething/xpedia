'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Collection, ThemeWithCollections } from '@/types/database';

interface Props {
  themes: ThemeWithCollections[];
  uncategorized: Collection[];
  uncategorizedTweetCount: number;
}

export default function ThemeSidebar({ themes, uncategorized, uncategorizedTweetCount }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const activeId = pathname.match(/\/dashboard\/collection\/([^/]+)/)?.[1];
    const initial = new Set<string>();
    if (activeId) {
      const parent = themes.find((t) => t.collections.some((c) => c.id === activeId));
      if (parent) initial.add(parent.id);
    }
    return initial;
  });

  function toggle(themeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  }

  const activeCollectionId = pathname.match(/\/dashboard\/collection\/([^/]+)/)?.[1];

  return (
    <aside className="w-56 shrink-0 border-r border-seam bg-ink min-h-[calc(100vh-113px)] py-4 px-3 overflow-y-auto">
      {themes.map((theme) => {
        const isOpen = expanded.has(theme.id);
        return (
          <div key={theme.id} className="mb-1">
            <div className="flex w-full items-center justify-between">
              <Link
                href={`/dashboard/theme/${theme.id}`}
                className="flex-1 truncate px-2 py-1.5 font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors"
              >
                {theme.name}
              </Link>
              <button
                onClick={() => toggle(theme.id)}
                className="shrink-0 px-2 py-1.5 text-shadow hover:text-parchment transition-colors"
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {isOpen ? '▾' : '▸'}
              </button>
            </div>

            {isOpen && (
              <div className="ml-2 mt-0.5 border-l border-seam pl-2">
                {theme.collections.map((col) => {
                  const isActive = col.id === activeCollectionId;
                  return (
                    <Link
                      key={col.id}
                      href={`/dashboard/collection/${col.id}`}
                      className={`block truncate px-2 py-1 text-xs transition-colors rounded ${
                        isActive
                          ? 'text-gold font-medium bg-gold/10'
                          : 'text-shadow hover:text-parchment'
                      }`}
                    >
                      {col.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {uncategorized.length > 0 && (
        <div className="mt-4 border-t border-seam pt-4">
          <span className="px-2 font-mono text-xs tracking-widest text-shadow uppercase">
            Uncategorized ({uncategorized.length})
          </span>
          <div className="ml-2 mt-1 border-l border-seam pl-2">
            {uncategorized.map((col) => {
              const isActive = col.id === activeCollectionId;
              return (
                <Link
                  key={col.id}
                  href={`/dashboard/collection/${col.id}`}
                  className={`block truncate px-2 py-1 text-xs transition-colors rounded ${
                    isActive
                      ? 'text-gold font-medium bg-gold/10'
                      : 'text-shadow hover:text-parchment'
                  }`}
                >
                  {col.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Uncategorized tweet inbox */}
      {uncategorizedTweetCount > 0 && (
        <div className="mt-4 border-t border-seam pt-4">
          <Link
            href="/dashboard/inbox"
            className={`flex items-center justify-between px-2 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors rounded ${
              pathname === '/dashboard/inbox'
                ? 'text-gold bg-gold/10'
                : 'text-shadow hover:text-parchment'
            }`}
          >
            <span>Inbox</span>
            <span className="ml-2 rounded-full bg-coral/15 text-coral px-1.5 py-0.5 normal-case tracking-normal">
              {uncategorizedTweetCount}
            </span>
          </Link>
        </div>
      )}

      {themes.length === 0 && uncategorized.length === 0 && uncategorizedTweetCount === 0 && (
        <p className="px-2 font-mono text-xs text-shadow">No collections yet.</p>
      )}
    </aside>
  );
}
