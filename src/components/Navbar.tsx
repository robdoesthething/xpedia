'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    <nav className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
      <span className="text-base font-bold tracking-tight text-stone-900">Xpedia</span>
      <div className="flex items-center gap-4">
        {user && <span className="text-sm text-stone-400">{user.email}</span>}
        <button
          onClick={handleSignOut}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
