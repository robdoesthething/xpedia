'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Collections', href: '/dashboard' },
  { label: 'Recent Tweets', href: '/dashboard/tweets' },
] as const;

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 border-b border-gray-200 bg-white px-6">
      {tabs.map((tab) => {
        const isActive = tab.href === '/dashboard' ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
