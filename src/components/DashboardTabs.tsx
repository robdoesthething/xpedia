'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const allTabs = [
  { label: 'Collections', href: '/dashboard', adminOnly: false },
  { label: 'Sources', href: '/dashboard/tweets', adminOnly: false },
  { label: 'Users', href: '/dashboard/users', adminOnly: true },
  { label: 'Admin', href: '/dashboard/admin', adminOnly: true },
] as const;

interface DashboardTabsProps {
  isAdmin?: boolean;
}

export default function DashboardTabs({ isAdmin }: DashboardTabsProps) {
  const pathname = usePathname();

  const tabs = allTabs.filter((tab) => !tab.adminOnly || isAdmin);

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
