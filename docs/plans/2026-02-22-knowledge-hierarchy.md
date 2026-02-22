# Knowledge Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a two-level knowledge hierarchy (Theme → Collection → Tweets) with a persistent left-sidebar tree for navigation.

**Architecture:** A new `themes` table groups collections. The AI categorisation prompt is extended to return a `theme_name` alongside `collection_name`. The dashboard layout gains a fixed `ThemeSidebar` client component fed initial data from the server layout; the main content pane is unchanged.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), Tailwind CSS, TypeScript, esbuild-bundled Chrome extension (not touched in this plan).

---

## Task 1: Database migration — create `themes` table

**Files:**
- Run SQL in Supabase SQL Editor (no file to commit; document the migration)

**Step 1: Run this SQL in Supabase → SQL Editor → New Query**

```sql
-- 1. Create themes table
CREATE TABLE themes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique theme name per user (case-insensitive)
CREATE UNIQUE INDEX themes_user_id_name_idx ON themes (user_id, lower(name));

-- RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own themes" ON themes;
CREATE POLICY "Users manage own themes"
  ON themes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add theme_id FK to collections (nullable — existing rows stay as-is)
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES themes(id) ON DELETE SET NULL;
```

**Step 2: Verify the migration ran cleanly**

In Supabase → Table Editor, check:
- `themes` table exists with columns `id, user_id, name, created_at, updated_at`
- `collections` table has a new `theme_id` column (nullable)

**Step 3: Commit a note about the migration**

```bash
git commit --allow-empty -m "chore(db): add themes table and collections.theme_id (migration applied)"
```

---

## Task 2: TypeScript types

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add `Theme` interface and `theme_id` to `Collection`**

In `src/types/database.ts`, after the `User` interface add:

```typescript
export interface Theme {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
```

And update `Collection` to add one field after `updated_at`:

```typescript
  theme_id: string | null;
```

The full `Collection` interface becomes:

```typescript
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  type: 'topic' | 'project';
  description: string | null;
  ai_summary: string | null;
  ai_conclusions: string[] | null;
  summary_updated_at: string | null;
  tweet_count: number;
  theme_id: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: 0 errors (the new field is nullable, so nothing breaks).

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add Theme interface and collections.theme_id"
```

---

## Task 3: Extend AI router — categorize returns `theme_name`

**Files:**
- Modify: `src/lib/ai-router.ts`

**Step 1: Update `CategorizationResult` interface** (line 21)

Replace:
```typescript
interface CategorizationResult {
  collection_name: string;
  summary: string;
  provider: string;
}
```
With:
```typescript
interface CategorizationResult {
  theme_name: string;
  collection_name: string;
  summary: string;
  provider: string;
}
```

**Step 2: Update the system prompt** in `categorize()` (line 135)

Replace the entire `systemPrompt` string with:

```typescript
    const systemPrompt = `You categorize tweets into specific, actionable collections under broad themes, and write sharp one-line summaries.

Rules:
- Assign a broad 2-4 word THEME (e.g. "Programming", "Business Strategy", "AI & Machine Learning", "Design Thinking", "Personal Development").
  Prefer reusing an existing theme name when a good match exists.
- Assign a SPECIFIC, ACTIONABLE collection within that theme — not vague categories.
  GOOD: "Pricing Strategy Tactics", "React Performance Patterns", "Cold Email Templates", "Fundraising Pitch Tips"
  BAD: "Tech", "Business", "Programming", "Interesting Thoughts", "General Advice"
- Collection names should be 2-5 words, title-cased, describing a skill or knowledge area someone would actively study.
- Prefer assigning to an existing collection if the tweet fits.
- The summary must capture the SPECIFIC actionable insight, not just restate the topic.
  GOOD: "Use tiered pricing anchored to a decoy option to increase average deal size by 20-30%"
  BAD: "A tweet about pricing strategies"

${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`;
```

**Step 3: Update the JSON parsing block** (lines 184–198)

Replace:
```typescript
      return {
        collection_name: String(parsed.collection_name).trim(),
        summary: String(parsed.summary).trim(),
        provider: result.provider,
      };
```
With:
```typescript
      if (!parsed.theme_name || !parsed.collection_name || !parsed.summary) {
        console.error('[AI] Invalid categorization response:', result.content);
        return null;
      }
      return {
        theme_name: String(parsed.theme_name).trim(),
        collection_name: String(parsed.collection_name).trim(),
        summary: String(parsed.summary).trim(),
        provider: result.provider,
      };
```

And remove the old guard check (the `if (!parsed.collection_name || !parsed.summary)` line above it).

**Step 4: Type-check**

```bash
npm run type-check
```

Expected: errors referencing `theme_name` missing in `categorizeTweetsInBackground` — that's correct, we fix those in the next task.

**Step 5: Commit** (after the next task passes type-check)

Hold — commit together with Task 4.

---

## Task 4: Background categorisation — resolve theme, assign to collection

**Files:**
- Modify: `src/app/api/tweets/route.ts`

**Step 1: Add `resolveTheme()` function** at the bottom of the file, after `resolveCollection()`:

```typescript
async function resolveTheme(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  themeName: string,
  themeMap: Map<string, string>
): Promise<string | null> {
  const existing = themeMap.get(themeName.toLowerCase());
  if (existing) return existing;

  const { data, error } = await supabase
    .from('themes')
    .insert({ user_id: userId, name: themeName })
    .select('id')
    .single();

  if (error) {
    // Race condition: re-fetch
    const { data: fallback } = await supabase
      .from('themes')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', themeName)
      .single();

    if (fallback) {
      themeMap.set(themeName.toLowerCase(), fallback.id);
      return fallback.id;
    }

    console.error(`[AI] Failed to create theme "${themeName}":`, error.message);
    return null;
  }

  themeMap.set(themeName.toLowerCase(), data.id);
  console.log(`[AI] Created theme "${themeName}" (${data.id})`);
  return data.id;
}
```

**Step 2: Update `categorizeTweetsInBackground()`**

a) After the `collectionMap` is built (around line 191), add a `themeMap`:

```typescript
    const themeMap = new Map<string, string>();
    // Pre-populate from existing themes
    const { data: themes } = await supabase
      .from('themes')
      .select('id, name')
      .eq('user_id', userId);
    for (const t of themes ?? []) {
      themeMap.set(t.name.toLowerCase(), t.id);
    }
```

b) Inside the `tweets.map(async (tweet) => { ... })` callback, after `const result = await aiRouter.categorize(...)`, resolve the theme before resolving the collection:

```typescript
        if (!result) return;

        // Resolve or create theme
        const themeId = await resolveTheme(
          supabase,
          userId,
          result.theme_name,
          themeMap
        );

        // Resolve or create collection
        const collectionId = await resolveCollection(
          supabase,
          userId,
          result.collection_name,
          collectionMap
        );
        if (!collectionId) return;

        // Assign theme to the collection if not already set
        if (themeId) {
          await supabase
            .from('collections')
            .update({ theme_id: themeId })
            .eq('id', collectionId)
            .is('theme_id', null); // only set if not already assigned
        }
```

c) The `update tweet` call already sets `collection_id` and `ai_summary` — leave it unchanged.

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/lib/ai-router.ts src/app/api/tweets/route.ts
git commit -m "feat(ai): extend categorize to assign themes and resolve theme_id on collections"
```

---

## Task 5: `/api/themes` route

**Files:**
- Create: `src/app/api/themes/route.ts`

**Step 1: Create the file**

```typescript
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/themes — List user's themes with collection count.
 * Auth: Cookie-based.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('themes')
    .select('id, name, created_at, collections(count)')
    .order('name');

  if (error) {
    console.error('[DB] Failed to fetch themes:', error.message);
    return Response.json({ error: 'Failed to fetch themes' }, { status: 500 });
  }

  // Flatten count from Supabase aggregate
  const themes = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    created_at: t.created_at,
    collection_count: Array.isArray(t.collections) ? (t.collections[0] as { count: number })?.count ?? 0 : 0,
  }));

  return Response.json({ themes });
}

/**
 * POST /api/themes — Create a theme manually.
 * Auth: Cookie-based.
 * Body: { name: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 100) {
    return Response.json(
      { error: 'Name must be between 1 and 100 characters' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('themes')
    .insert({ user_id: user.id, name })
    .select('id, name')
    .single();

  if (error) {
    console.error('[DB] Failed to create theme:', error.message);
    return Response.json({ error: 'Failed to create theme' }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/app/api/themes/route.ts
git commit -m "feat(api): add /api/themes GET and POST endpoints"
```

---

## Task 6: `ThemeSidebar` component

**Files:**
- Create: `src/components/ThemeSidebar.tsx`

This is a client component. It receives themes + collections as props (from the server layout) so there's no client-side fetch. It uses `usePathname()` to highlight the active collection and `useState` for expand/collapse.

**Step 1: Create the file**

```typescript
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
}

export default function ThemeSidebar({ themes, uncategorized }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Pre-expand the theme that contains the active collection
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
            <button
              onClick={() => toggle(theme.id)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-left font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors"
            >
              <span className="truncate">{theme.name}</span>
              <span className="ml-1 shrink-0 text-shadow">
                {isOpen ? '▾' : '▸'}
              </span>
            </button>

            {isOpen && (
              <div className="ml-2 mt-0.5 border-l border-seam pl-2">
                {theme.collections.map((col) => {
                  const isActive = col.id === activeCollectionId;
                  return (
                    <Link
                      key={col.id}
                      href={`/dashboard/collection/${col.id}`}
                      className={`block truncate px-2 py-1 text-xs transition-colors ${
                        isActive
                          ? 'text-gold font-medium'
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
                  className={`block truncate px-2 py-1 text-xs transition-colors ${
                    isActive
                      ? 'text-gold font-medium'
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

      {themes.length === 0 && uncategorized.length === 0 && (
        <p className="px-2 font-mono text-xs text-shadow">No collections yet.</p>
      )}
    </aside>
  );
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/ThemeSidebar.tsx
git commit -m "feat(ui): add ThemeSidebar with collapsible theme tree"
```

---

## Task 7: Update `DashboardLayout` — two-panel with sidebar

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

The layout becomes `async` so it can fetch data server-side. It renders ThemeSidebar alongside the page children.

**Step 1: Replace the layout file**

```typescript
import Navbar from '@/components/Navbar';
import DashboardTabs from '@/components/DashboardTabs';
import SearchBar from '@/components/SearchBar';
import ThemeSidebar from '@/components/ThemeSidebar';
import { createClient } from '@/lib/supabase/server';
import type { Collection, Theme } from '@/types/database';

interface ThemeWithCollections extends Theme {
  collections: Collection[];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // Fetch all collections with their theme info in one query
  const { data: collections } = await supabase
    .from('collections')
    .select('*, themes(id, name, created_at, updated_at)')
    .order('name')
    .returns<(Collection & { themes: Theme | null })[]>();

  const allCollections = collections ?? [];

  // Build theme → collections map
  const themeMap = new Map<string, ThemeWithCollections>();
  const uncategorized: Collection[] = [];

  for (const col of allCollections) {
    const theme = (col as Collection & { themes: Theme | null }).themes;
    if (theme && col.theme_id) {
      if (!themeMap.has(theme.id)) {
        themeMap.set(theme.id, { ...theme, collections: [] });
      }
      themeMap.get(theme.id)!.collections.push(col);
    } else {
      uncategorized.push(col);
    }
  }

  const themes = Array.from(themeMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="min-h-screen bg-void">
      <Navbar />
      <div className="flex items-center justify-between border-b border-seam bg-ink px-6">
        <DashboardTabs />
        <SearchBar />
      </div>
      <div className="flex">
        <ThemeSidebar themes={themes} uncategorized={uncategorized} />
        <main className="flex-1 min-w-0 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

**Step 3: Run dev server and verify visually**

```bash
npm run dev
```

- Open `http://localhost:3000/dashboard`
- Sidebar should appear on the left with themes listed
- Existing collections with no theme should appear under "Uncategorized"
- Clicking a collection should navigate to its detail page with the sidebar still visible

**Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(ui): two-panel dashboard layout with ThemeSidebar"
```

---

## Task 8: Update dashboard home — group collections by theme

**Files:**
- Modify: `src/app/dashboard/page.tsx`

The dashboard home now shows collections grouped by theme rather than a flat grid.

**Step 1: Replace the page**

```typescript
import { createClient } from '@/lib/supabase/server';
import CollectionCard from '@/components/CollectionCard';
import NewCollectionButton from '@/components/NewCollectionButton';
import type { Collection, Theme } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from('collections')
    .select('*, themes(id, name, created_at, updated_at)')
    .order('name')
    .returns<(Collection & { themes: Theme | null })[]>();

  const allCollections = collections ?? [];

  if (allCollections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-3xl text-parchment">No collections yet</h2>
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
        <h2 className="font-serif text-3xl text-parchment">Your Knowledge</h2>
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
          <h3 className="mb-4 font-mono text-xs tracking-widest text-shadow uppercase border-b border-seam pb-2">
            Uncategorized
          </h3>
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

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

**Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Final visual verification**

```bash
npm run dev
```

- `/dashboard` shows collections grouped under theme section headers
- Sidebar tree matches the grouping
- Clicking a theme in sidebar expands it; clicking a collection navigates correctly
- New bookmarks captured via the extension will appear under the correct theme after AI categorisation

**Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(ui): group dashboard collections by theme with section headers"
```

---

## Summary of changed files

| File | Change |
|------|--------|
| Supabase SQL | New `themes` table + `collections.theme_id` |
| `src/types/database.ts` | `Theme` interface + `Collection.theme_id` |
| `src/lib/ai-router.ts` | `theme_name` in prompt + response |
| `src/app/api/tweets/route.ts` | `resolveTheme()` + assign to collection |
| `src/app/api/themes/route.ts` | New: GET + POST themes |
| `src/components/ThemeSidebar.tsx` | New: collapsible sidebar component |
| `src/app/dashboard/layout.tsx` | Async, two-panel with sidebar |
| `src/app/dashboard/page.tsx` | Theme-grouped collection grid |
