'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); setLoading(false); return; }
        // If session is null, email confirmation is required
        if (!data.session) { setEmailSent(true); setLoading(false); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); setLoading(false); return; }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach auth server. Please try again.');
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Xpedia</span>
          <div className="mt-8 text-4xl mb-6">📬</div>
          <h1 className="font-serif text-3xl text-parchment mb-3">Check your email</h1>
          <p className="text-sm text-mist leading-relaxed mb-8">
            We sent a confirmation link to <strong className="text-parchment">{email}</strong>.
            Click it to activate your account, then come back to sign in.
          </p>
          <button
            onClick={() => { setEmailSent(false); setIsSignUp(false); }}
            className="font-mono text-xs text-shadow hover:text-mist transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="mb-10 text-center">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Xpedia</span>
          <h1 className="mt-3 font-serif text-4xl text-parchment">
            {isSignUp ? 'Create account' : <em className="italic">Welcome back.</em>}
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block font-mono text-xs tracking-widest text-mist uppercase mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-ink border border-seam px-4 py-3 text-sm text-parchment placeholder:text-shadow focus:border-gold focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block font-mono text-xs tracking-widest text-mist uppercase mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ink border border-seam px-4 py-3 text-sm text-parchment placeholder:text-shadow focus:border-gold focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-void font-mono text-sm tracking-widest uppercase px-4 py-3 hover:bg-gold-bright transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create account →' : 'Sign in →'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-xs text-shadow">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-mist hover:text-parchment transition-colors"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
