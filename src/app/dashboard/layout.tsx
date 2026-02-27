import Navbar from '@/components/Navbar';
import DashboardTabs from '@/components/DashboardTabs';
import SearchBar from '@/components/SearchBar';
import ThemeSidebar from '@/components/ThemeSidebar';
import OnboardingGate from '@/components/onboarding/OnboardingGate';
import UpgradeBanner from '@/components/UpgradeBanner';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Collection, Theme } from '@/types/database';
import { groupCollectionsByTheme } from '@/lib/utils';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // Fetch profile for onboarding gate
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('onboarding_completed, plan').eq('id', user.id).single()
    : { data: null };

  const showOnboarding = profile ? !profile.onboarding_completed : false;
  const isPro = profile?.plan === 'pro';
  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin = Boolean(adminEmail && user?.email === adminEmail);

  // Fetch all collections with their theme info in one query
  const { data: collections, error } = await supabase
    .from('collections')
    .select('*, themes(id, name, created_at, updated_at)')
    .order('name')
    .returns<(Collection & { themes: Theme | null })[]>();

  if (error) console.error('[DB] Error fetching collections for sidebar:', error.message);

  const allCollections = collections ?? [];

  // Build theme → collections map
  const { themeMap, uncategorized } = groupCollectionsByTheme(allCollections);

  const themes = Array.from(themeMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Count uncategorized tweets (tweets with no collection_id)
  const { count: uncategorizedTweetCount } = await supabase
    .from('tweets')
    .select('id', { count: 'exact', head: true })
    .is('collection_id', null);

  return (
    <div className="min-h-screen bg-void">
      <Navbar />
      <div className="flex items-center justify-between border-b border-seam bg-ink px-6">
        <DashboardTabs isAdmin={isAdmin} />
        <SearchBar />
      </div>
      <div className="flex">
        <ThemeSidebar themes={themes} uncategorized={uncategorized} uncategorizedTweetCount={uncategorizedTweetCount ?? 0} />
        <main className="flex-1 min-w-0 px-6 py-8">{children}</main>
      </div>
      {showOnboarding && <OnboardingGate isPro={isPro} />}
      <Suspense><UpgradeBanner /></Suspense>
    </div>
  );
}
