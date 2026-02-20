import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Go to Dashboard' : 'Get Started Free';

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <nav className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold tracking-tight text-stone-900">Xpedia</span>
          <Link
            href={ctaHref}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            {user ? 'Dashboard' : 'Sign In'}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-28 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-amber-600">
          Knowledge from bookmarks
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-stone-900 sm:text-6xl">
          Turn your X bookmarks<br />into knowledge
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-500">
          Xpedia captures your bookmarks, organizes them by topic using AI, and generates
          living documents you can export as LLM context.
        </p>
        <div className="mt-10">
          <Link
            href={ctaHref}
            className="rounded-md bg-amber-500 px-7 py-3 text-base font-medium text-white shadow-sm hover:bg-amber-600"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-stone-200 bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-stone-900">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-px bg-stone-200 sm:grid-cols-3">
            <div className="bg-white p-8">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">01</p>
              <h3 className="mb-3 text-lg font-semibold text-stone-900">Capture</h3>
              <p className="text-sm leading-relaxed text-stone-500">
                Install the Chrome extension. Visit your X bookmarks and Xpedia captures
                every tweet, thread, and linked article automatically.
              </p>
            </div>
            <div className="bg-white p-8">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">02</p>
              <h3 className="mb-3 text-lg font-semibold text-stone-900">Organize</h3>
              <p className="text-sm leading-relaxed text-stone-500">
                AI categorizes bookmarks into specific, actionable collections —
                not vague buckets like "Tech" but "React Performance Patterns."
              </p>
            </div>
            <div className="bg-white p-8">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">03</p>
              <h3 className="mb-3 text-lg font-semibold text-stone-900">Export</h3>
              <p className="text-sm leading-relaxed text-stone-500">
                Each collection becomes a living document with summaries and
                conclusions. Export Markdown ready for any LLM.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-stone-900 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">
          Ready to organize your bookmarks?
        </h2>
        <p className="mt-2 text-stone-400">Free to start. No credit card required.</p>
        <div className="mt-8">
          <Link
            href={ctaHref}
            className="rounded-md bg-amber-500 px-7 py-3 text-base font-medium text-white shadow-sm hover:bg-amber-600"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
        &copy; {new Date().getFullYear()} Xpedia. All rights reserved.
      </footer>
    </div>
  );
}
