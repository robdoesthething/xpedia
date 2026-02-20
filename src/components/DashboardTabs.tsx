'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Collections', href: '/dashboard' },
  { label: 'Uncategorized', href: '/dashboard/tweets' },
  { label: 'Users', href: '/dashboard/users' },
  { label: 'Admin', href: '/dashboard/admin' },
] as const;

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      {tabs.map((tab) => {
        const isActive =
          tab.href === '/dashboard'
            ? pathname === '/dashboard' || pathname.startsWith('/dashboard/collection/')
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-1 py-3 font-mono text-xs tracking-widest uppercase transition-colors ${
              isActive
                ? 'border-gold text-parchment'
                : 'border-transparent text-shadow hover:border-seam hover:text-mist'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
