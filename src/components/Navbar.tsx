'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  const router = useRouter();
  const { user } = useAuth();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between border-b border-seam bg-ink px-6 py-4">
      <span className="font-serif font-bold text-lg text-parchment">Xpedia</span>
      <div className="flex items-center gap-5">
        {user && <span className="font-mono text-xs text-shadow">{user.email}</span>}
        <Link
          href="/dashboard/settings"
          className="font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors"
        >
          Settings
        </Link>
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
