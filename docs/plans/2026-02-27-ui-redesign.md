# UI/UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh Xpedia's visual identity from a warm literary aesthetic to a playful indie-premium style (Daniel Nguyen-inspired) using Indigo+Coral palette, Syne display font, and polished card/layout effects — across both landing page and app UI.

**Architecture:** Token-rename approach — existing Tailwind color names (`void`, `ink`, `gold`, etc.) are kept but their underlying CSS values are replaced. This means all existing components get the new palette automatically without touching every file. Only files with structural or typographic changes need direct edits.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, next/font/google (Syne replacing Cormorant Garamond), React

---

## Task 1: Update color tokens + add utilities in globals.css

**Files:**
- Modify: `src/app/globals.css`

### Step 1: Replace the file content

```css
@import 'tailwindcss';

@theme inline {
  /* Typography */
  --font-serif:  var(--font-syne), Georgia, serif;
  --font-sans:   var(--font-dm-sans), system-ui, sans-serif;
  --font-mono:   var(--font-jetbrains), 'Courier New', monospace;

  /* Semantic color tokens */
  --color-void:        var(--app-void);
  --color-ink:         var(--app-ink);
  --color-quill:       var(--app-quill);
  --color-seam:        var(--app-seam);
  --color-veil:        var(--app-veil);
  --color-parchment:   var(--app-parchment);
  --color-mist:        var(--app-mist);
  --color-shadow:      var(--app-shadow);
  --color-gold:        var(--app-gold);
  --color-gold-bright: var(--app-gold-bright);
  --color-coral:       var(--app-coral);
  --color-coral-bright: var(--app-coral-bright);
}

/* ── Light mode (default) ── */
:root {
  --app-void:         #FAFAF8;   /* indigo-tinted cream bg        */
  --app-ink:          #FFFFFF;   /* white card surface            */
  --app-quill:        #F4F4FD;   /* indigo-tinted hover           */
  --app-seam:         #E2E2F0;   /* indigo-tinted border          */
  --app-veil:         #D0D0E8;   /* stronger border               */

  --app-parchment:    #0D0E1A;   /* near-black primary text       */
  --app-mist:         #6B6B8A;   /* secondary text                */
  --app-shadow:       #9B9BB0;   /* muted text                    */

  --app-gold:         #5B5FFA;   /* indigo accent                 */
  --app-gold-bright:  #4A4EF0;   /* indigo hover                  */

  --app-coral:        #FF6E4A;   /* coral CTA                     */
  --app-coral-bright: #F05A38;   /* coral hover                   */
}

/* ── Dark mode ── */
.dark {
  --app-void:         #0D0E1A;   /* deep indigo-black bg          */
  --app-ink:          #161726;   /* dark card surface             */
  --app-quill:        #1E1F33;   /* hovered card                  */
  --app-seam:         #2A2B45;   /* visible border                */
  --app-veil:         #363758;   /* strong border                 */

  --app-parchment:    #F0F0FF;   /* bright readable primary       */
  --app-mist:         #9494B8;   /* secondary                     */
  --app-shadow:       #5A5A7A;   /* muted                         */

  --app-gold:         #5B5FFA;   /* same indigo in dark           */
  --app-gold-bright:  #6A6EFF;   /* lighter indigo hover          */

  --app-coral:        #FF7A5A;   /* slightly lighter coral        */
  --app-coral-bright: #FF8C6A;   /* coral hover                   */
}

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--app-void);
  color: var(--app-parchment);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--app-void); }
::-webkit-scrollbar-thumb { background: var(--app-seam); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--app-veil); }

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--app-gold);
  outline-offset: 2px;
}

/* Selection */
::selection {
  background: color-mix(in srgb, var(--app-gold) 20%, transparent);
  color: var(--app-parchment);
}

/* Card shadow + hover lift utility */
.card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(91, 95, 250, 0.05);
  border-radius: 12px;
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(91, 95, 250, 0.12);
}
```

### Step 2: Verify no build errors

```bash
npm run type-check
```

Expected: 0 errors (globals.css change is pure CSS, no TS impact)

### Step 3: Commit

```bash
git add src/app/globals.css
git commit -m "style: replace color tokens with indigo+coral palette, add card utilities"
```

---

## Task 2: Swap Cormorant Garamond for Syne in layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

### Step 1: Replace font setup

```tsx
import type { Metadata } from 'next';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import ThemeProvider from '@/components/ThemeProvider';
import './globals.css';

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Xpedia — Knowledge from Bookmarks',
  description: 'Turn your X bookmarks into a structured knowledge corpus',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### Step 2: Run type-check

```bash
npm run type-check
```

Expected: 0 errors

### Step 3: Commit

```bash
git add src/app/layout.tsx
git commit -m "style: swap Cormorant Garamond for Syne as display font"
```

---

## Task 3: Rewrite landing page (page.tsx)

**Files:**
- Modify: `src/app/page.tsx`

This is a full structural rewrite. The Supabase auth logic is preserved; only the markup and classes change.

### Step 1: Replace the entire file

```tsx
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
            className="inline-flex items-center gap-1.5 bg-coral text-white font-sans text-sm font-semibold px-4 py-2 rounded-lg hover:bg-coral-bright transition-colors"
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
              'radial-gradient(ellipse 700px 450px at 85% -5%, rgba(91,95,250,0.13) 0%, transparent 70%)',
              'radial-gradient(ellipse 550px 550px at -5% 110%, rgba(124,58,237,0.09) 0%, transparent 70%)',
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
            <span className="text-gold">knowledge corpus</span>
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
              className="inline-flex items-center gap-2 bg-coral text-white font-sans text-sm font-semibold px-6 py-3 rounded-lg hover:bg-coral-bright active:scale-[0.98] transition-all"
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
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-seam" />
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
              <div className="font-serif text-4xl font-bold text-parchment">{num}</div>
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
              },
              {
                icon: '🧠',
                title: 'AI categorization',
                desc: 'Not "Tech" — "React Performance Patterns." Granular, specific topics that actually help you think.',
              },
              {
                icon: '📄',
                title: 'LLM-ready export',
                desc: 'Each collection becomes a structured Markdown document you can drop straight into any AI chat.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card bg-ink border border-seam p-6">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center text-lg mb-4">
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
                <div className="font-serif text-[72px] font-bold text-seam leading-none select-none mb-2">
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
          className="inline-flex items-center gap-2 bg-coral text-white font-sans text-sm font-semibold px-8 py-4 rounded-lg hover:bg-coral-bright active:scale-[0.98] transition-all"
        >
          {ctaLabel} — free forever →
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
```

### Step 2: Type-check

```bash
npm run type-check
```

Expected: 0 errors

### Step 3: Commit

```bash
git add src/app/page.tsx
git commit -m "feat(landing): full page redesign with hero mesh, product mockup, pricing, features"
```

---

## Task 4: Update CollectionCard with card shadow + border radius

**Files:**
- Modify: `src/components/CollectionCard.tsx`

### Step 1: Add `card` CSS class and update border radius

Change the outer `<Link>` className from:
```
"block border border-seam bg-ink p-5 transition-colors hover:border-gold/40 hover:bg-quill"
```
to:
```
"card block border border-seam bg-ink p-5 rounded-xl transition-colors hover:border-gold/40 hover:bg-quill"
```

Change the collection name from `font-serif` to `font-serif font-semibold` for stronger weight with Syne.

Full updated file:

```tsx
import Link from 'next/link';
import type { Collection } from '@/types/database';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link
      href={`/dashboard/collection/${collection.id}`}
      className="card block border border-seam bg-ink p-5 rounded-xl transition-colors hover:border-gold/40 hover:bg-quill"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif font-semibold text-lg leading-snug text-parchment">
          {collection.name}
        </h3>
        <span className="shrink-0 font-mono text-xs tracking-widest text-shadow uppercase mt-1">
          {collection.type}
        </span>
      </div>

      {(collection.description ?? collection.ai_summary) && (
        <p className="mt-2 text-sm leading-relaxed text-mist line-clamp-2">
          {collection.description ?? collection.ai_summary}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between font-mono text-xs text-shadow">
        <span>
          {collection.tweet_count} {collection.tweet_count === 1 ? 'item' : 'items'}
        </span>
        <span>{formatDate(collection.updated_at)}</span>
      </div>
    </Link>
  );
}
```

### Step 2: Type-check

```bash
npm run type-check
```

Expected: 0 errors

### Step 3: Commit

```bash
git add src/components/CollectionCard.tsx
git commit -m "style(card): add card shadow, hover lift, rounded corners"
```

---

## Task 5: Update ThemeSidebar active states + inbox badge

**Files:**
- Modify: `src/components/ThemeSidebar.tsx`

### Step 1: Two targeted changes

**Change 1** — Active collection link (line ~72): from
```
isActive ? 'text-gold font-medium' : 'text-shadow hover:text-parchment'
```
to:
```
isActive ? 'text-gold font-medium bg-gold/10 rounded px-2' : 'text-shadow hover:text-parchment'
```

**Change 2** — Inbox badge (line ~126): from
```
"ml-2 rounded-full bg-seam px-1.5 py-0.5 text-mist normal-case tracking-normal"
```
to:
```
"ml-2 rounded-full bg-coral/15 text-coral px-1.5 py-0.5 normal-case tracking-normal"
```

Full updated file:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Collection, Theme } from '@/types/database';

interface ThemeWithCollections extends Theme {
  collections: Collection[];
}

interface Props {
  themes: ThemeWithCollections[];
  uncategorized: Collection[];
  uncategorizedTweetCount: number;
}

export default function ThemeSidebar({ themes, uncategorized, uncategorizedTweetCount }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const activeId = pathname.match(/\/dashboard\/collection\/([^/]+)/)?.[1];
    const initial = new Set<string>();
    if (activeId) {
      const parent = themes.find((t) => t.collections.some((c) => c.id === activeId));
      if (parent) initial.add(parent.id);
    }
    return initial;
  });

  function toggle(themeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  }

  const activeCollectionId = pathname.match(/\/dashboard\/collection\/([^/]+)/)?.[1];

  return (
    <aside className="w-56 shrink-0 border-r border-seam bg-ink min-h-[calc(100vh-113px)] py-4 px-3 overflow-y-auto">
      {themes.map((theme) => {
        const isOpen = expanded.has(theme.id);
        return (
          <div key={theme.id} className="mb-1">
            <div className="flex w-full items-center justify-between">
              <Link
                href={`/dashboard/theme/${theme.id}`}
                className="flex-1 truncate px-2 py-1.5 font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors"
              >
                {theme.name}
              </Link>
              <button
                onClick={() => toggle(theme.id)}
                className="shrink-0 px-2 py-1.5 text-shadow hover:text-parchment transition-colors"
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {isOpen ? '▾' : '▸'}
              </button>
            </div>

            {isOpen && (
              <div className="ml-2 mt-0.5 border-l border-seam pl-2">
                {theme.collections.map((col) => {
                  const isActive = col.id === activeCollectionId;
                  return (
                    <Link
                      key={col.id}
                      href={`/dashboard/collection/${col.id}`}
                      className={`block truncate px-2 py-1 text-xs transition-colors rounded ${
                        isActive
                          ? 'text-gold font-medium bg-gold/10'
                          : 'text-shadow hover:text-parchment'
                      }`}
                    >
                      {col.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {uncategorized.length > 0 && (
        <div className="mt-4 border-t border-seam pt-4">
          <span className="px-2 font-mono text-xs tracking-widest text-shadow uppercase">
            Uncategorized ({uncategorized.length})
          </span>
          <div className="ml-2 mt-1 border-l border-seam pl-2">
            {uncategorized.map((col) => {
              const isActive = col.id === activeCollectionId;
              return (
                <Link
                  key={col.id}
                  href={`/dashboard/collection/${col.id}`}
                  className={`block truncate px-2 py-1 text-xs transition-colors rounded ${
                    isActive
                      ? 'text-gold font-medium bg-gold/10'
                      : 'text-shadow hover:text-parchment'
                  }`}
                >
                  {col.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Uncategorized tweet inbox */}
      {uncategorizedTweetCount > 0 && (
        <div className="mt-4 border-t border-seam pt-4">
          <Link
            href="/dashboard/inbox"
            className={`flex items-center justify-between px-2 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors rounded ${
              pathname === '/dashboard/inbox'
                ? 'text-gold bg-gold/10'
                : 'text-shadow hover:text-parchment'
            }`}
          >
            <span>Inbox</span>
            <span className="ml-2 rounded-full bg-coral/15 text-coral px-1.5 py-0.5 normal-case tracking-normal">
              {uncategorizedTweetCount}
            </span>
          </Link>
        </div>
      )}

      {themes.length === 0 && uncategorized.length === 0 && uncategorizedTweetCount === 0 && (
        <p className="px-2 font-mono text-xs text-shadow">No collections yet.</p>
      )}
    </aside>
  );
}
```

### Step 2: Type-check

```bash
npm run type-check
```

Expected: 0 errors

### Step 3: Commit

```bash
git add src/components/ThemeSidebar.tsx
git commit -m "style(sidebar): indigo active highlight, coral inbox badge"
```

---

## Task 6: Update Navbar branding

**Files:**
- Modify: `src/components/Navbar.tsx`

### Step 1: Update logo from mono to serif bold, add rounded corners to nav

Change logo from:
```
<span className="font-mono text-sm tracking-widest text-gold uppercase">Xpedia</span>
```
to:
```
<span className="font-serif font-bold text-lg text-parchment">Xpedia</span>
```

Full updated file:

```tsx
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
```

### Step 2: Type-check

```bash
npm run type-check
```

Expected: 0 errors

### Step 3: Commit

```bash
git add src/components/Navbar.tsx
git commit -m "style(navbar): Syne bold logo, aligned with new brand"
```

---

## Task 7: Update dashboard empty state

**Files:**
- Modify: `src/app/dashboard/page.tsx`

### Step 1: Update empty state and page header

Change empty state from generic `font-serif` to bolder styling, add a more engaging empty state message. Change `"Your Knowledge"` headline to use `font-bold`.

```tsx
import { createClient } from '@/lib/supabase/server';
import CollectionCard from '@/components/CollectionCard';
import NewCollectionButton from '@/components/NewCollectionButton';
import AssignThemesButton from '@/components/AssignThemesButton';
import type { Collection, Theme } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: collections, error } = await supabase
    .from('collections')
    .select('*, themes(id, name, created_at, updated_at)')
    .order('name')
    .returns<(Collection & { themes: Theme | null })[]>();

  if (error) console.error('[DB] Error fetching collections:', error.message);

  const allCollections = collections ?? [];

  if (allCollections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-2xl mb-6">
          📚
        </div>
        <h2 className="font-serif font-bold text-3xl text-parchment">No collections yet</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">
          Install the Chrome extension and capture your first bookmarks. They&apos;ll be
          automatically organized into collections here.
        </p>
        <div className="mt-8">
          <NewCollectionButton />
        </div>
      </div>
    );
  }

  // Group by theme
  const themeMap = new Map<string, { theme: Theme; collections: Collection[] }>();
  const uncategorized: Collection[] = [];

  for (const col of allCollections) {
    const theme = (col as Collection & { themes: Theme | null }).themes;
    if (theme && col.theme_id) {
      if (!themeMap.has(theme.id)) {
        themeMap.set(theme.id, { theme, collections: [] });
      }
      themeMap.get(theme.id)!.collections.push(col);
    } else {
      uncategorized.push(col);
    }
  }

  const groups = Array.from(themeMap.values()).sort((a, b) =>
    a.theme.name.localeCompare(b.theme.name)
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-serif font-bold text-3xl text-parchment">Your Knowledge</h2>
        <NewCollectionButton />
      </div>

      {groups.map(({ theme, collections }) => (
        <section key={theme.id} className="mb-10">
          <h3 className="mb-4 font-mono text-xs tracking-widest text-mist uppercase border-b border-seam pb-2">
            {theme.name}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((col) => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        </section>
      ))}

      {uncategorized.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between border-b border-seam pb-2">
            <h3 className="font-mono text-xs tracking-widest text-shadow uppercase">
              Uncategorized
            </h3>
            <AssignThemesButton count={uncategorized.length} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uncategorized.map((col) => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

### Step 2: Type-check + lint + build

```bash
npm run type-check && npm run lint && npm run build
```

Expected: 0 errors, 0 warnings, build succeeds

### Step 3: Commit

```bash
git add src/app/dashboard/page.tsx
git commit -m "style(dashboard): bolder header, improved empty state"
```

---

## Task 8: Final verification + deploy

### Step 1: Run full check suite

```bash
npm run type-check && npm run lint && npm run build
```

Expected: All pass

### Step 2: Deploy to production

```bash
vercel --prod
```

Expected: Build succeeds, production URL printed

### Step 3: Visual smoke test checklist

- [ ] Landing page: gradient mesh visible in hero, coral CTA button, product mockup renders
- [ ] Landing page: dark mode toggle switches correctly
- [ ] Dashboard: collection cards have rounded corners + shadow
- [ ] Dashboard: active sidebar item has indigo highlight
- [ ] Dashboard: inbox badge is coral
- [ ] Navbar: logo is Syne serif bold
- [ ] All `font-serif` elements now render in Syne (geometric, bold)
- [ ] All `text-gold` / `bg-gold` elements are now indigo

### Step 4: Commit any fixes

```bash
git add -p
git commit -m "fix(ui): post-deploy visual fixes"
```
