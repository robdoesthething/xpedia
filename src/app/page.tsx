import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ThemeToggle from '@/components/ThemeToggle';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Open dashboard' : 'Get started free';

  return (
    <div className="min-h-screen bg-void text-parchment">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <span className="font-mono text-sm tracking-widest text-mist uppercase">Xpedia</span>
        <div className="flex items-center gap-6">
          <ThemeToggle />
          <Link
            href={ctaHref}
            className="font-mono text-xs tracking-widest text-gold uppercase hover:text-gold-bright transition-colors"
          >
            {user ? 'Dashboard →' : 'Sign in →'}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase mb-8">
            A private knowledge engine
          </p>

          <h1 className="font-serif text-[clamp(52px,8vw,96px)] leading-[0.95] tracking-tight text-parchment">
            Your bookmarks,
            <br />
            <em className="italic text-gold">organized.</em>
          </h1>

          <p className="mt-10 max-w-lg text-base leading-relaxed text-mist font-sans">
            Xpedia captures your X bookmarks, categorizes them by topic using AI,
            and generates living knowledge documents — ready to export as LLM context.
          </p>

          <div className="mt-12 flex items-center gap-6">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-gold text-void font-mono text-sm tracking-widest uppercase px-6 py-3 hover:bg-gold-bright transition-colors"
            >
              {ctaLabel} →
            </Link>
            <span className="font-mono text-xs text-shadow">No credit card required</span>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-t border-seam">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-seam">
          {[
            {
              num: '01',
              title: 'Capture',
              body: 'Install the Chrome extension. Visit your X bookmarks and Xpedia captures every tweet, thread, and linked article automatically — no API required.',
            },
            {
              num: '02',
              title: 'Organize',
              body: 'AI categorizes bookmarks into specific, actionable collections. Not "Tech" — "React Performance Patterns." Not "Business" — "Cold Email Conversion Tactics."',
            },
            {
              num: '03',
              title: 'Export',
              body: 'Each collection becomes a living document with AI-generated summaries and actionable conclusions. Export Markdown ready for any LLM context window.',
            },
          ].map(({ num, title, body }) => (
            <div key={num} className="px-8 py-12">
              <p className="font-mono text-xs text-gold mb-4">{num}</p>
              <h3 className="font-serif text-2xl text-parchment mb-3">{title}</h3>
              <p className="text-sm leading-relaxed text-mist">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-seam px-8 py-20">
        <div className="max-w-2xl">
          <h2 className="font-serif text-[clamp(32px,5vw,56px)] leading-tight text-parchment">
            Start building your <em className="italic text-gold">knowledge corpus</em> today.
          </h2>
          <div className="mt-8">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-gold text-void font-mono text-sm tracking-widest uppercase px-6 py-3 hover:bg-gold-bright transition-colors"
            >
              {ctaLabel} →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-seam px-8 py-6 flex items-center justify-between">
        <span className="font-mono text-xs text-shadow">© {new Date().getFullYear()} Xpedia</span>
        <span className="font-mono text-xs text-shadow">Private beta</span>
      </footer>
    </div>
  );
}
