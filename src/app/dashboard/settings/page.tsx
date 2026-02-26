import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from('profiles').select('plan, onboarding_completed').eq('id', user.id).single()
    : { data: null };

  return (
    <div className="max-w-2xl">
      <h2 className="mb-8 font-serif text-3xl text-parchment">Settings</h2>

      {/* Account section */}
      <section className="mb-10">
        <h3 className="mb-4 font-mono text-xs tracking-widest text-mist uppercase border-b border-seam pb-2">
          Account
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-mist">Email</span>
            <span className="font-mono text-xs text-parchment">{user?.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-mist">Plan</span>
            <span className={`font-mono text-xs uppercase tracking-widest ${profile?.plan === 'pro' ? 'text-gold' : 'text-shadow'}`}>
              {profile?.plan ?? 'free'}
            </span>
          </div>
        </div>
      </section>

      <SettingsClient />
    </div>
  );
}
