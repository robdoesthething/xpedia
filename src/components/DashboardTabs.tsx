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
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-amber-500 text-stone-900'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
