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

      {/* ── Sticky Nav ── */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-void/80 border-b border-seam">
        <span className="font-serif font-bold text-lg tracking-tight text-parchment">Xpedia</span>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href={ctaHref}
            className="btn-shimmer inline-flex items-center gap-1.5 text-white font-sans text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {ctaLabel} →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        {/* Gradient mesh blobs */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'radial-gradient(ellipse 800px 500px at 90% -10%, rgba(91,95,250,0.25) 0%, transparent 65%)',
              'radial-gradient(ellipse 600px 600px at -10% 115%, rgba(124,58,237,0.18) 0%, transparent 65%)',
              'radial-gradient(ellipse 400px 300px at 60% 100%, rgba(255,110,74,0.12) 0%, transparent 60%)',
            ].join(', '),
          }}
        />

        <div className="relative max-w-4xl">
          {/* Badge chip */}
          <div className="inline-flex items-center gap-2 bg-gold/10 text-gold border border-gold/20 rounded-full px-3 py-1 font-mono text-xs tracking-wide mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />
            AI-powered knowledge tool for X bookmarks
          </div>

          {/* Headline */}
          <h1 className="font-serif font-extrabold text-[clamp(40px,7vw,80px)] leading-[1.05] tracking-tight text-parchment">
            Turn your bookmarks
            <br />
            into a{' '}
            <span className="gradient-text">knowledge corpus</span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist">
            Xpedia captures your X bookmarks, organizes them by topic using AI,
            and builds living knowledge documents — ready to export as LLM context.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={ctaHref}
              className="btn-shimmer inline-flex items-center gap-2 text-white font-sans text-sm font-semibold px-6 py-3 rounded-lg"
            >
              {ctaLabel} <span>→</span>
            </Link>
            <a
              href="#how-it-works"
              className="text-sm text-mist hover:text-parchment transition-colors"
            >
              See how it works ↓
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {(['#5B5FFA', '#7C3AED', '#FF6E4A', '#10B981'] as const).map((c, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-void"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-sm text-mist">Trusted by knowledge builders</span>
          </div>
        </div>
      </section>

      {/* ── Product mockup ── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div
            className="rounded-xl overflow-hidden border border-seam"
            style={{ boxShadow: '0 24px 64px rgba(91,95,250,0.14), 0 4px 16px rgba(0,0,0,0.08)' }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 bg-ink border-b border-seam px-4 py-3">
              <div className="flex gap-1.5">
                {(['#FF5F57', '#FEBC2E', '#28C840'] as const).map((c) => (
                  <div key={c} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex-1 mx-4 bg-void rounded px-3 py-1 font-mono text-xs text-shadow truncate">
                app.xpedia.io/dashboard
              </div>
            </div>
            {/* App preview */}
            <div className="flex h-72 bg-void overflow-hidden">
              <div className="w-48 shrink-0 border-r border-seam bg-ink p-3 flex flex-col gap-1">
                <div className="font-mono text-[10px] text-shadow uppercase tracking-widest px-2 py-1 mb-1">
                  Collections
                </div>
                {['AI & ML', 'Product Design', 'Cold Email', 'React Patterns', 'Mental Models'].map(
                  (name, i) => (
                    <div
                      key={name}
                      className={`px-2 py-1.5 rounded text-xs truncate ${
                        i === 0
                          ? 'bg-gold/10 text-gold font-medium'
                          : 'text-mist'
                      }`}
                    >
                      {name}
                    </div>
                  )
                )}
              </div>
              <div className="flex-1 p-6 overflow-hidden">
                <div className="font-serif text-xl font-bold text-parchment mb-4">AI & ML</div>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="card bg-ink border border-seam p-3">
                      <div className="h-2 bg-seam rounded w-3/4 mb-2" />
                      <div className="h-2 bg-seam/60 rounded w-full mb-1" />
                      <div className="h-2 bg-seam/60 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-seam px-6 py-12">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { num: '10k+', label: 'Tweets organized' },
            { num: '500+', label: 'Collections created' },
            { num: '1', label: 'Person built this' },
          ].map(({ num, label }) => (
            <div key={label}>
              <div className="gradient-text font-serif text-5xl font-bold">{num}</div>
              <div className="mt-1 font-mono text-xs text-shadow uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase mb-4">Features</p>
          <h2 className="font-serif font-bold text-[clamp(28px,4vw,44px)] text-parchment mb-12">
            Everything you need to build
            <br />a personal knowledge base
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '⚡',
                title: 'Zero-API capture',
                desc: 'Chrome extension reads your X bookmarks directly — no API key, no limitations, no waitlist.',
                iconStyle: { background: 'linear-gradient(135deg, #FF6E4A, #FF9D7E)' },
              },
              {
                icon: '🧠',
                title: 'AI categorization',
                desc: 'Not "Tech" — "React Performance Patterns." Granular, specific topics that actually help you think.',
                iconStyle: { background: 'linear-gradient(135deg, #5B5FFA, #818CF8)' },
              },
              {
                icon: '📄',
                title: 'LLM-ready export',
                desc: 'Each collection becomes a structured Markdown document you can drop straight into any AI chat.',
                iconStyle: { background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' },
              },
            ].map(({ icon, title, desc, iconStyle }) => (
              <div key={title} className="card bg-ink border border-seam p-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4" style={iconStyle}>
                  {icon}
                </div>
                <h3 className="font-serif font-semibold text-lg text-parchment mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-mist">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="border-t border-seam bg-ink px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase mb-4">How it works</p>
          <h2 className="font-serif font-bold text-[clamp(28px,4vw,44px)] text-parchment mb-12">
            Three steps to clarity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                n: '01',
                title: 'Capture',
                body: 'Install the Chrome extension. Visit x.com/bookmarks. Xpedia captures every tweet, thread, and linked article — automatically.',
              },
              {
                n: '02',
                title: 'Organize',
                body: 'AI sorts your bookmarks into specific collections. Runs in the background. Check back to find your knowledge already structured.',
              },
              {
                n: '03',
                title: 'Export',
                body: 'Each collection is a living document with summaries and conclusions. Export Markdown and paste into any LLM context window.',
              },
            ].map(({ n, title, body }) => (
              <div key={n}>
                <div className="gradient-text font-serif text-[80px] font-bold leading-none select-none mb-2">
                  {n}
                </div>
                <h3 className="font-serif font-semibold text-xl text-parchment mb-3">{title}</h3>
                <p className="text-sm leading-relaxed text-mist">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase mb-4 text-center">
            Pricing
          </p>
          <h2 className="font-serif font-bold text-[clamp(28px,4vw,44px)] text-parchment mb-12 text-center">
            Simple, honest pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="card bg-ink border border-seam p-8">
              <div className="font-mono text-xs tracking-widest text-shadow uppercase mb-4">Free</div>
              <div className="font-serif text-4xl font-bold text-parchment mb-1">$0</div>
              <div className="text-sm text-mist mb-8">Forever free</div>
              <ul className="space-y-3 mb-8">
                {['Up to 3 collections', '5 AI categorizations/month', 'Basic export'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-mist">
                    <span className="text-gold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={ctaHref}
                className="block text-center border border-seam text-parchment text-sm font-medium py-3 rounded-lg hover:bg-quill transition-colors"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="card bg-ink border-2 border-gold p-8 relative">
              <div className="absolute -top-3 left-6">
                <span className="bg-gold text-white font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full">
                  Most popular
                </span>
              </div>
              <div className="font-mono text-xs tracking-widest text-gold uppercase mb-4">Pro</div>
              <div className="font-serif text-4xl font-bold text-parchment mb-1">$29</div>
              <div className="text-sm text-mist mb-8">One-time payment</div>
              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited collections',
                  'Unlimited AI categorizations',
                  'Full export + LLM export',
                  'Priority support',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-parchment">
                    <span className="text-gold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={ctaHref}
                className="block text-center bg-coral text-white text-sm font-semibold py-3 rounded-lg hover:bg-coral-bright transition-colors"
              >
                Get Pro — $29
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section className="border-t border-seam bg-ink px-6 py-20 text-center">
        <h2 className="font-serif font-bold text-[clamp(28px,4vw,44px)] text-parchment mb-4">
          Start building your knowledge corpus
        </h2>
        <p className="text-mist mb-8 max-w-md mx-auto">
          Join knowledge builders who turn their X bookmarks into something actually useful.
        </p>
        <Link
          href={ctaHref}
          className="btn-shimmer inline-flex items-center gap-2 text-white font-sans text-sm font-semibold px-8 py-4 rounded-lg"
        >
          {ctaLabel}{!user && ' — free forever'} →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-seam px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-serif font-bold text-parchment">Xpedia</span>
        <span className="font-mono text-xs text-shadow">
          Built by a solo maker · © {new Date().getFullYear()}
        </span>
        <div className="flex items-center gap-6">
          <ThemeToggle />
          <Link
            href="/login"
            className="font-mono text-xs text-shadow hover:text-mist transition-colors"
          >
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
