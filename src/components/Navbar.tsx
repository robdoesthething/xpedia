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
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <h1 className="text-lg font-bold text-gray-900">Xpedia</h1>
      <div className="flex items-center gap-4">
        {user && <span className="text-sm text-gray-500">{user.email}</span>}
        <button
          onClick={handleSignOut}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
