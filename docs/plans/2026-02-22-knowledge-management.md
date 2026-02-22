# Knowledge Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Xpedia with a full knowledge management loop: persistent extension badge, all-tweets Sources view with manual assignment, theme CRUD, collection-level key-people output, and theme-level synthesis + rolling digest.

**Architecture:** 11 sequential tasks: DB migration → types → extension badge → sources redesign → theme CRUD API → theme detail page → sidebar CRUD → collection key-people → theme synthesise API → theme synthesis UI → theme digest UI. Each task touches isolated files.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS), esbuild Chrome MV3 extension, multi-provider AI via `aiRouter`, Tailwind CSS.

---

## Task 1: DB Migration — new columns and theme_digests table

**Files:**
- Create: `supabase/migrations/20260222010000_knowledge_management.sql`

**Step 1: Write the migration**

```sql
-- collections: key people output
ALTER TABLE collections ADD COLUMN IF NOT EXISTS ai_key_people jsonb;

-- themes: synthesis fields
ALTER TABLE themes ADD COLUMN IF NOT EXISTS ai_insights text[];
ALTER TABLE themes ADD COLUMN IF NOT EXISTS ai_key_people jsonb;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS synthesis_updated_at timestamptz;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS last_tweet_count int;

-- theme_digests: rolling digest entries per theme
CREATE TABLE IF NOT EXISTS theme_digests (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    uuid         NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_count int          NOT NULL,
  kta         text[]       NOT NULL,
  new_voices  jsonb        NOT NULL DEFAULT '[]',
  created_at  timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE theme_digests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own digests" ON theme_digests;
CREATE POLICY "Users manage own digests" ON theme_digests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Step 2: Apply to remote Supabase**

```bash
supabase db push
```
Expected: "Remote database is up to date." or lists the new migration.

**Step 3: Commit**

```bash
git add supabase/migrations/20260222010000_knowledge_management.sql
git commit -m "chore(db): add ai_key_people, theme synthesis columns, and theme_digests table"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Update Collection type**

Add after `ai_conclusions`:
```typescript
ai_key_people: { handle: string; reason: string }[] | null;
```

**Step 2: Update Theme type**

Replace the current `Theme` interface with:
```typescript
export interface Theme {
  id: string;
  user_id: string;
  name: string;
  ai_insights: string[] | null;
  ai_key_people: { handle: string; reason: string }[] | null;
  synthesis_updated_at: string | null;
  last_tweet_count: number | null;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Add ThemeDigest type**

```typescript
export interface ThemeDigest {
  id: string;
  theme_id: string;
  user_id: string;
  tweet_count: number;
  kta: string[];
  new_voices: { handle: string; reason: string }[];
  created_at: string;
}
```

**Step 4: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add ai_key_people, Theme synthesis fields, ThemeDigest"
```

---

## Task 3: Extension badge — uncategorized count

**Files:**
- Create: `src/app/api/tweets/uncategorized-count/route.ts`
- Modify: `src/chrome-extension/lib/api.ts`
- Modify: `src/chrome-extension/background.ts`

**Step 1: Create the API route**

```typescript
// src/app/api/tweets/uncategorized-count/route.ts
import { NextRequest } from 'next/server';
import { createClientFromToken } from '@/lib/supabase/api';
import { getCorsHeaders, corsOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request);
  const { searchParams } = new URL(request.url);
  const token =
    searchParams.get('access_token') ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return Response.json({ error: 'Missing auth token' }, { status: 401, headers: cors });
  }

  const supabase = createClientFromToken(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const { count, error } = await supabase
    .from('tweets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('collection_id', null);

  if (error) {
    return Response.json({ error: 'Failed to count' }, { status: 500, headers: cors });
  }

  return Response.json({ count: count ?? 0 }, { headers: cors });
}
```

**Step 2: Add fetchUncategorizedCount to api.ts**

Add after `fetchSavedUrls`:
```typescript
export async function fetchUncategorizedCount(token: string): Promise<number> {
  const res = await fetch(
    `${API_BASE}/api/tweets/uncategorized-count?access_token=${encodeURIComponent(token)}`
  );
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
}
```

**Step 3: Update background.ts to refresh badge after capture**

In `handleTweetsExtracted`, after `updateBadge(result.saved)` call replace the `updateBadge` call with a refresh from the server:

```typescript
// After sendTweets succeeds, fetch accurate count from server
const count = await fetchUncategorizedCount(token);
updateBadge(count);
```

Also update imports at top of background.ts:
```typescript
import { getToken } from './lib/auth.js';
import { fetchSavedUrls, sendTweets, fetchUncategorizedCount } from './lib/api.js';
```

**Step 4: Build extension**

```bash
npm run build:extension
```
Expected: three ⚡ Done lines, no errors.

**Step 5: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 6: Commit**

```bash
git add src/app/api/tweets/uncategorized-count/route.ts \
        src/chrome-extension/lib/api.ts \
        src/chrome-extension/background.ts \
        dist/chrome-extension/background.js \
        dist/chrome-extension/lib/
git commit -m "feat(extension): persistent badge showing uncategorized tweet count"
```

---

## Task 4: Sources page — all tweets with filter tabs

**Files:**
- Create: `src/components/SourcesFilter.tsx`
- Modify: `src/app/dashboard/tweets/page.tsx`

**Step 1: Create SourcesFilter client component**

```typescript
// src/components/SourcesFilter.tsx
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
  collections: { id: string; name: string }[];
  uncategorizedCount: number;
  totalCount: number;
}

export default function SourcesFilter({ collections, uncategorizedCount, totalCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get('filter') ?? 'all';

  function setFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const tabs = [
    { key: 'all', label: `All (${totalCount})` },
    { key: 'uncategorized', label: `Uncategorized (${uncategorizedCount})` },
    ...collections.map((c) => ({ key: c.id, label: c.name })),
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setFilter(tab.key)}
          className={`font-mono text-xs tracking-widest uppercase px-3 py-1.5 border transition-colors ${
            active === tab.key
              ? 'border-gold text-gold'
              : 'border-seam text-shadow hover:border-gold/40 hover:text-mist'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Rewrite TweetsPage**

```typescript
// src/app/dashboard/tweets/page.tsx
import { createClient } from '@/lib/supabase/server';
import TweetListWithMove from '@/components/TweetListWithMove';
import CategorizeButton from '@/components/CategorizeButton';
import SourcesFilter from '@/components/SourcesFilter';
import type { Tweet } from '@/types/database';

export default async function TweetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  const [allTweetsResult, uncategorizedCountResult, collectionsResult] = await Promise.all([
    supabase
      .from('tweets')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(100)
      .returns<Tweet[]>(),
    supabase
      .from('tweets')
      .select('id', { count: 'exact', head: true })
      .is('collection_id', null),
    supabase.from('collections').select('id, name').order('name'),
  ]);

  const allTweets = allTweetsResult.data ?? [];
  const uncategorizedCount = uncategorizedCountResult.count ?? 0;
  const collections = (collectionsResult.data ?? []) as { id: string; name: string }[];

  // Apply filter
  let tweets = allTweets;
  if (filter === 'uncategorized') {
    tweets = allTweets.filter((t) => !t.collection_id);
  } else if (filter && filter !== 'all') {
    tweets = allTweets.filter((t) => t.collection_id === filter);
  }

  if (allTweets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="font-serif text-3xl text-parchment">No sources yet</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">
          Install the Chrome extension, sign in, and visit your X bookmarks page to capture tweets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-serif text-3xl text-parchment">Sources ({allTweets.length})</h2>
        {uncategorizedCount > 0 && <CategorizeButton tweetCount={uncategorizedCount} />}
      </div>
      <SourcesFilter
        collections={collections}
        uncategorizedCount={uncategorizedCount}
        totalCount={allTweets.length}
      />
      <TweetListWithMove tweets={tweets} collections={collections} />
    </div>
  );
}
```

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/SourcesFilter.tsx src/app/dashboard/tweets/page.tsx
git commit -m "feat(ui): sources page shows all tweets with filter tabs"
```

---

## Task 5: Theme CRUD API routes

**Files:**
- Create: `src/app/api/themes/[id]/route.ts`

**Step 1: Create the route file**

```typescript
// src/app/api/themes/[id]/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/themes/[id] — Theme detail with collections and digests.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [themeRes, collectionsRes, digestsRes] = await Promise.all([
    supabase.from('themes').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('collections').select('*, themes(id, name, created_at, updated_at)')
      .eq('theme_id', id).eq('user_id', user.id).order('name'),
    supabase.from('theme_digests').select('*')
      .eq('theme_id', id).eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
  ]);

  if (!themeRes.data) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({
    theme: themeRes.data,
    collections: collectionsRes.data ?? [],
    digests: digestsRes.data ?? [],
  });
}

/**
 * PATCH /api/themes/[id] — Rename a theme.
 * Body: { name: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 100) {
    return Response.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('themes').update({ name }).eq('id', id).eq('user_id', user.id)
    .select('id, name').single();

  if (error || !data) {
    if (error?.code === '23505') return Response.json({ error: 'A theme with that name already exists' }, { status: 409 });
    return Response.json({ error: 'Theme not found' }, { status: 404 });
  }

  return Response.json(data);
}

/**
 * DELETE /api/themes/[id] — Delete a theme.
 * Collections become uncategorized (theme_id SET NULL via DB).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('themes').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    console.error('[DB] Failed to delete theme:', error.message);
    return Response.json({ error: 'Failed to delete theme' }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

**Step 2: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/app/api/themes/[id]/route.ts
git commit -m "feat(api): add GET/PATCH/DELETE /api/themes/[id]"
```

---

## Task 6: Theme detail page

**Files:**
- Create: `src/app/dashboard/theme/[id]/page.tsx`
- Create: `src/app/dashboard/theme/[id]/loading.tsx`

**Step 1: Create loading skeleton**

```typescript
// src/app/dashboard/theme/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-48 bg-seam rounded" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-seam rounded" />)}
      </div>
    </div>
  );
}
```

**Step 2: Create theme detail page**

```typescript
// src/app/dashboard/theme/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CollectionCard from '@/components/CollectionCard';
import ThemeActions from '@/components/ThemeActions';
import ThemeSynthesisPanel from '@/components/ThemeSynthesisPanel';
import type { Collection, Theme, ThemeDigest } from '@/types/database';

export default async function ThemeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [themeRes, collectionsRes, digestsRes] = await Promise.all([
    supabase.from('themes').select('*').eq('id', id).single<Theme>(),
    supabase.from('collections')
      .select('*, themes(id, name, created_at, updated_at)')
      .eq('theme_id', id)
      .order('name')
      .returns<(Collection & { themes: Theme | null })[]>(),
    supabase.from('theme_digests').select('*')
      .eq('theme_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<ThemeDigest[]>(),
  ]);

  if (!themeRes.data) notFound();

  const theme = themeRes.data;
  const collections = collectionsRes.data ?? [];
  const digests = digestsRes.data ?? [];

  // Count total tweets across all collections to detect new ones
  const totalTweets = collections.reduce((sum, c) => sum + (c.tweet_count ?? 0), 0);
  const newTweetCount = theme.last_tweet_count !== null
    ? Math.max(0, totalTweets - theme.last_tweet_count)
    : totalTweets;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors"
      >
        &larr; Collections
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <h1 className="font-serif text-4xl text-parchment">{theme.name}</h1>
        <ThemeActions themeId={id} initialName={theme.name} />
      </div>

      {collections.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {collections.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      ) : (
        <p className="mb-12 text-sm text-shadow">No collections in this theme yet.</p>
      )}

      <ThemeSynthesisPanel
        themeId={id}
        theme={theme}
        digests={digests}
        newTweetCount={newTweetCount}
      />
    </div>
  );
}
```

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: errors for missing components `ThemeActions` and `ThemeSynthesisPanel` — that's expected, we add them next.

**Step 4: Commit after next two tasks are done (do not commit yet)**

---

## Task 7: Sidebar theme CRUD UI + ThemeActions component

**Files:**
- Create: `src/components/ThemeActions.tsx`
- Modify: `src/components/ThemeSidebar.tsx`

**Step 1: Create ThemeActions component**

```typescript
// src/components/ThemeActions.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ThemeActions({
  themeId,
  initialName,
}: {
  themeId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRename() {
    setSaving(true);
    const res = await fetch(`/api/themes/${themeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (res.ok) { setEditing(false); router.refresh(); }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/themes/${themeId}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) { router.push('/dashboard'); router.refresh(); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="bg-void border border-seam px-3 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
        />
        <button
          onClick={handleRename}
          disabled={saving || !name.trim()}
          className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => { setName(initialName); setEditing(false); }}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-red-400">Delete theme? Collections become uncategorized.</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="border border-red-700 bg-red-900/50 font-mono text-xs tracking-widest text-red-300 uppercase px-3 py-1.5 hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="border border-seam font-mono text-xs tracking-widest text-mist uppercase px-3 py-1.5 hover:border-gold/40 hover:text-parchment transition-colors"
      >
        Rename
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="border border-red-900/50 font-mono text-xs tracking-widest text-red-400 uppercase px-3 py-1.5 hover:border-red-700 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}
```

**Step 2: Update ThemeSidebar — link theme names to /dashboard/theme/[id]**

In `src/components/ThemeSidebar.tsx`, find the theme name button/span in the sidebar tree and wrap it with a `<Link href={/dashboard/theme/${theme.id}}>` (or replace the toggle button with a two-zone element: clicking the name navigates, clicking the arrow toggles expand/collapse).

The exact change: In the theme header row, add a `<Link>` around the theme name text while keeping the expand/collapse arrow as a separate button:

```tsx
// Modify the theme header row to look like:
<div className="flex items-center justify-between">
  <Link
    href={`/dashboard/theme/${theme.id}`}
    className="font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors"
  >
    {theme.name}
  </Link>
  <button onClick={() => toggleTheme(theme.id)}>
    {/* expand/collapse arrow */}
  </button>
</div>
```

Read the current ThemeSidebar.tsx first to find the exact lines to edit before modifying.

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: no errors (assuming ThemeSynthesisPanel is added in Task 8).

**Step 4: Commit (together with Task 6 page)**

```bash
git add src/app/dashboard/theme/ src/components/ThemeActions.tsx src/components/ThemeSidebar.tsx
git commit -m "feat(ui): theme detail page with ThemeActions and sidebar navigation"
```

---

## Task 8: Collection regenerate — add key people output

**Files:**
- Modify: `src/lib/ai-router.ts`
- Modify: `src/lib/regenerate-collection.ts`
- Modify: `src/app/dashboard/collection/[id]/page.tsx`

**Step 1: Add generateKeyPeople to aiRouter**

In `src/lib/ai-router.ts`, add after `generateConclusions`:

```typescript
/**
 * Generate key people to follow from a collection's tweets.
 */
async generateKeyPeople(
  tweets: { author_handle: string; content: string }[],
  userId?: string
): Promise<{ handle: string; reason: string }[] | null> {
  const handles = [...new Set(tweets.map((t) => `@${t.author_handle}`))].join(', ');
  const tweetBlock = tweets
    .map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`)
    .join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You identify the most valuable people to follow based on the tweets they contributed to this collection.

Contributors: ${handles}

Rules:
- Select up to 5 contributors whose tweets showed the most concrete, actionable value.
- For each, write a one-line reason (max 15 words) explaining why they're worth following — based on what THEY specifically shared, not generic praise.
- Only include handles that actually appear in the tweet list.

Return ONLY a JSON array: [{"handle": "username_without_@", "reason": "..."}, ...]`,
    },
    { role: 'user', content: tweetBlock },
  ];

  const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 400);
  if (!result) return null;

  logAiCall({ userId, provider: result.provider, operation: 'key_people', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

  try {
    const parsed = JSON.parse(cleanJson(result.content));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((p: unknown) => p && typeof p === 'object' && 'handle' in p && 'reason' in p)
      .map((p: { handle: unknown; reason: unknown }) => ({
        handle: String(p.handle).replace(/^@/, ''),
        reason: String(p.reason),
      }));
  } catch {
    console.error('[AI] Failed to parse key_people JSON:', result.content);
    return null;
  }
},
```

**Step 2: Update regenerateCollectionDocument to also generate key people**

In `src/lib/regenerate-collection.ts`, replace the final `Promise.all` call:

```typescript
// Replace:
const [summary, conclusions] = await Promise.all([
  aiRouter.generateSummary(collectionName, tweets, userId),
  aiRouter.generateConclusions(collectionName, tweets, userId),
]);

const updates: Record<string, unknown> = { summary_updated_at: new Date().toISOString() };
if (summary) updates.ai_summary = summary;
if (conclusions) updates.ai_conclusions = conclusions;

// With:
const [conclusions, keyPeople] = await Promise.all([
  aiRouter.generateConclusions(collectionName, tweets, userId),
  aiRouter.generateKeyPeople(tweets, userId),
]);

const updates: Record<string, unknown> = { summary_updated_at: new Date().toISOString() };
if (conclusions) updates.ai_conclusions = conclusions;
if (keyPeople) updates.ai_key_people = keyPeople;
```

Also remove the `summary` variable from the empty-case update:
```typescript
// In the rawTweets.length === 0 branch, change:
.update({ ai_summary: null, ai_conclusions: null, summary_updated_at: new Date().toISOString() })
// To:
.update({ ai_conclusions: null, ai_key_people: null, summary_updated_at: new Date().toISOString() })
```

**Step 3: Update collection detail page UI**

In `src/app/dashboard/collection/[id]/page.tsx`:

- Remove the `ai_summary` block entirely (the `{collection.ai_summary && ...}` section)
- Update the `ai_conclusions` section header from "Actionable Conclusions" to "Actionable Insights"
- Add a Key People section after the insights:

```tsx
{collection.ai_key_people && collection.ai_key_people.length > 0 && (
  <div className="mb-6 border border-seam bg-ink p-5">
    <h2 className="mb-3 font-mono text-xs tracking-widest text-gold uppercase">Key People to Follow</h2>
    <ul className="space-y-2">
      {collection.ai_key_people.map((person) => (
        <li key={person.handle} className="flex items-start gap-2 text-sm text-mist">
          <a
            href={`https://x.com/${person.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-mono text-gold hover:text-gold-bright transition-colors"
          >
            @{person.handle}
          </a>
          <span>— {person.reason}</span>
        </li>
      ))}
    </ul>
  </div>
)}
```

Also update the collection query to include `ai_key_people`:
```typescript
// The .select('*, themes(...)') query already fetches all columns via '*', no change needed.
```

**Step 4: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 5: Commit**

```bash
git add src/lib/ai-router.ts src/lib/regenerate-collection.ts \
        src/app/dashboard/collection/\[id\]/page.tsx
git commit -m "feat(ai): replace collection summary with actionable insights + key people"
```

---

## Task 9: Theme synthesise API route

**Files:**
- Create: `src/app/api/themes/[id]/synthesise/route.ts`

The route runs two AI operations:
1. **Full synthesis** over all tweets in the theme → `insights[]` + `key_people[]` → saved to `themes`
2. **Digest** over tweets since last synthesis → `kta[]` + `new_voices[]` → inserted into `theme_digests`

```typescript
// src/app/api/themes/[id]/synthesise/route.ts
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { aiRouter } from '@/lib/ai-router';

export const maxDuration = 60;

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceClient();

  // Fetch the theme
  const { data: theme } = await service
    .from('themes').select('id, synthesis_updated_at, last_tweet_count')
    .eq('id', id).eq('user_id', user.id).single();

  if (!theme) return Response.json({ error: 'Theme not found' }, { status: 404 });

  // Fetch all collections in this theme
  const { data: collections } = await service
    .from('collections').select('id').eq('theme_id', id).eq('user_id', user.id);

  if (!collections?.length) return Response.json({ error: 'No collections in this theme' }, { status: 400 });

  const collectionIds = collections.map((c: { id: string }) => c.id);

  // Fetch all tweets in the theme
  const { data: allTweets } = await service
    .from('tweets')
    .select('id, author_handle, content, extracted_content, captured_at')
    .in('collection_id', collectionIds)
    .order('captured_at', { ascending: true });

  if (!allTweets?.length) return Response.json({ error: 'No tweets in this theme' }, { status: 400 });

  // Build tweet input (prefer extracted_content)
  const tweetInputs = allTweets.map((t: { author_handle: string; content: string; extracted_content?: string | null }) => ({
    author_handle: t.author_handle,
    content: t.extracted_content ?? t.content,
  }));

  // Determine new tweets since last synthesis for digest
  const lastSynthAt = theme.synthesis_updated_at;
  const newTweetInputs = lastSynthAt
    ? allTweets
        .filter((t: { captured_at: string }) => t.captured_at > lastSynthAt)
        .map((t: { author_handle: string; content: string; extracted_content?: string | null }) => ({
          author_handle: t.author_handle,
          content: t.extracted_content ?? t.content,
        }))
    : tweetInputs;

  // Run synthesis and digest in parallel
  const [insights, keyPeople, digestResult] = await Promise.all([
    aiRouter.generateInsights(tweetInputs, user.id),
    aiRouter.generateKeyPeople(tweetInputs, user.id),
    newTweetInputs.length > 0
      ? aiRouter.generateDigest(newTweetInputs, user.id)
      : Promise.resolve(null),
  ]);

  const now = new Date().toISOString();

  // Save synthesis to themes
  const { error: themeErr } = await service.from('themes').update({
    ai_insights: insights ?? [],
    ai_key_people: keyPeople ?? [],
    synthesis_updated_at: now,
    last_tweet_count: allTweets.length,
  }).eq('id', id);

  if (themeErr) {
    console.error('[AI] Failed to save theme synthesis:', themeErr.message);
    return Response.json({ error: 'Failed to save synthesis' }, { status: 500 });
  }

  // Insert digest entry if there are new tweets
  if (digestResult && newTweetInputs.length > 0) {
    const { error: digestErr } = await service.from('theme_digests').insert({
      theme_id: id,
      user_id: user.id,
      tweet_count: newTweetInputs.length,
      kta: digestResult.kta,
      new_voices: digestResult.new_voices,
    });
    if (digestErr) console.error('[AI] Failed to insert digest:', digestErr.message);
  }

  return Response.json({ ok: true, insights: insights?.length ?? 0 });
}
```

**Step 2: Add generateInsights and generateDigest to aiRouter**

In `src/lib/ai-router.ts`, add after `generateKeyPeople`:

```typescript
/**
 * Generate theme-level actionable insights from all tweets across collections.
 */
async generateInsights(
  tweets: { author_handle: string; content: string }[],
  userId?: string
): Promise<string[] | null> {
  const tweetBlock = tweets.map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`).join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You synthesise a theme-level knowledge brief from curated tweets across multiple collections.

Produce 5-10 actionable insights. Rules:
- Each insight must be something a reader can act on THIS WEEK.
- Include specific tools, frameworks, numbers, or scripts where the tweets contain them.
- Cross-reference ideas that appear in multiple tweets — consensus is more valuable.
- Flag any notable contrarian or surprising findings.

Return ONLY a JSON array of strings: ["insight 1", "insight 2", ...]`,
    },
    { role: 'user', content: tweetBlock },
  ];

  const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 1000);
  if (!result) return null;

  logAiCall({ userId, provider: result.provider, operation: 'insights', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

  try {
    const parsed = JSON.parse(cleanJson(result.content));
    if (!Array.isArray(parsed)) return null;
    return parsed.map(String);
  } catch {
    console.error('[AI] Failed to parse insights JSON:', result.content);
    return null;
  }
},

/**
 * Generate a digest (KTA + new voices) from tweets added since last synthesis.
 */
async generateDigest(
  tweets: { author_handle: string; content: string }[],
  userId?: string
): Promise<{ kta: string[]; new_voices: { handle: string; reason: string }[] } | null> {
  const tweetBlock = tweets.map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`).join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You write a concise digest of newly added tweets — like a newsletter entry for what's new.

Return JSON with exactly two keys:
- "kta": array of 3-5 key takeaways and actions from these specific new tweets
- "new_voices": array of up to 3 new contributors worth noting (people whose ideas stood out in this batch), each as {"handle": "...", "reason": "..."}

Return ONLY valid JSON: {"kta": [...], "new_voices": [...]}`,
    },
    { role: 'user', content: tweetBlock },
  ];

  const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 600);
  if (!result) return null;

  logAiCall({ userId, provider: result.provider, operation: 'digest', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

  try {
    const parsed = JSON.parse(cleanJson(result.content));
    if (!parsed.kta || !parsed.new_voices) return null;
    return {
      kta: Array.isArray(parsed.kta) ? parsed.kta.map(String) : [],
      new_voices: Array.isArray(parsed.new_voices) ? parsed.new_voices : [],
    };
  } catch {
    console.error('[AI] Failed to parse digest JSON:', result.content);
    return null;
  }
},
```

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/api/themes/\[id\]/synthesise/ src/lib/ai-router.ts
git commit -m "feat(ai): add theme synthesise route with insights, key people, and digest generation"
```

---

## Task 10: ThemeSynthesisPanel component

**Files:**
- Create: `src/components/ThemeSynthesisPanel.tsx`

This is the client component used on the theme detail page. It contains the Synthesise button, the synthesis output (insights + key people), the new-tweet nudge banner, and the digest history.

```typescript
// src/components/ThemeSynthesisPanel.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Theme, ThemeDigest } from '@/types/database';

interface Props {
  themeId: string;
  theme: Theme;
  digests: ThemeDigest[];
  newTweetCount: number;
}

export default function ThemeSynthesisPanel({ themeId, theme, digests, newTweetCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [expandedDigests, setExpandedDigests] = useState<Set<string>>(
    new Set(digests.slice(0, 1).map((d) => d.id))
  );

  async function handleSynthesise() {
    setLoading(true);
    const res = await fetch(`/api/themes/${themeId}/synthesise`, { method: 'POST' });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  function toggleDigest(id: string) {
    setExpandedDigests((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasInsights = theme.ai_insights && theme.ai_insights.length > 0;
  const hasKeyPeople = theme.ai_key_people && theme.ai_key_people.length > 0;

  return (
    <div className="space-y-8">
      {/* Synthesis section */}
      <div className="border border-seam">
        <div className="flex items-center justify-between border-b border-seam px-5 py-3">
          <h2 className="font-mono text-xs tracking-widest text-gold uppercase">Synthesis</h2>
          <div className="flex items-center gap-3">
            {newTweetCount > 0 && (
              <span className="font-mono text-xs text-mist">
                {newTweetCount} new tweet{newTweetCount !== 1 ? 's' : ''} since last synthesis
              </span>
            )}
            <button
              onClick={handleSynthesise}
              disabled={loading}
              className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors disabled:opacity-50"
            >
              {loading ? 'Synthesising…' : 'Synthesise ↻'}
            </button>
          </div>
        </div>

        <div className="p-5">
          {!hasInsights && !hasKeyPeople && (
            <p className="text-sm text-shadow">
              No synthesis yet. Click &ldquo;Synthesise&rdquo; to generate insights and key people from all tweets in this theme.
            </p>
          )}

          {hasInsights && (
            <div className="mb-6">
              <h3 className="mb-3 font-mono text-xs tracking-widest text-mist uppercase">Actionable Insights</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-mist">
                {theme.ai_insights!.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {hasKeyPeople && (
            <div>
              <h3 className="mb-3 font-mono text-xs tracking-widest text-mist uppercase">Key People to Follow</h3>
              <ul className="space-y-2">
                {theme.ai_key_people!.map((person) => (
                  <li key={person.handle} className="flex items-start gap-2 text-sm text-mist">
                    <a
                      href={`https://x.com/${person.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-gold hover:text-gold-bright transition-colors"
                    >
                      @{person.handle}
                    </a>
                    <span>— {person.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Digest history */}
      {digests.length > 0 && (
        <div className="border border-seam">
          <div className="border-b border-seam px-5 py-3">
            <h2 className="font-mono text-xs tracking-widest text-gold uppercase">Digest</h2>
          </div>
          <div className="divide-y divide-seam">
            {digests.map((digest) => {
              const expanded = expandedDigests.has(digest.id);
              const date = new Date(digest.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              return (
                <div key={digest.id} className="px-5 py-4">
                  <button
                    onClick={() => toggleDigest(digest.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-mono text-xs tracking-widest text-mist uppercase">
                      {date} — {digest.tweet_count} new tweet{digest.tweet_count !== 1 ? 's' : ''}
                    </span>
                    <span className="font-mono text-xs text-shadow">{expanded ? '▲' : '▼'}</span>
                  </button>

                  {expanded && (
                    <div className="mt-4 space-y-4">
                      {digest.kta.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-mono text-xs tracking-widest text-shadow uppercase">Key Takeaways & Actions</h4>
                          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-mist">
                            {digest.kta.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                      {digest.new_voices.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-mono text-xs tracking-widest text-shadow uppercase">New Voices</h4>
                          <ul className="space-y-1">
                            {digest.new_voices.map((v) => (
                              <li key={v.handle} className="flex items-start gap-2 text-sm text-mist">
                                <a
                                  href={`https://x.com/${v.handle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 font-mono text-gold hover:text-gold-bright transition-colors"
                                >
                                  @{v.handle}
                                </a>
                                <span>— {v.reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/ThemeSynthesisPanel.tsx
git commit -m "feat(ui): ThemeSynthesisPanel with synthesis output and digest history"
```

---

## Task 11: Final type-check, build, push

**Step 1: Full type-check**

```bash
npm run type-check
```
Expected: no errors.

**Step 2: Build**

```bash
npm run build
```
Expected: ✓ Compiled successfully.

**Step 3: Rebuild extension**

```bash
npm run build:extension
```
Expected: three ⚡ Done lines.

**Step 4: Push**

```bash
git push
```

---

## Task Order Dependencies

```
Task 1 (DB)
  └─ Task 2 (Types)
       ├─ Task 3 (Extension badge) — independent after types
       ├─ Task 4 (Sources page) — independent after types
       ├─ Task 5 (Theme CRUD API)
       │    └─ Task 6 (Theme detail page) ─┐
       │         └─ Task 7 (Sidebar+ThemeActions) ─┤
       ├─ Task 8 (Collection regen + key people)    │
       └─ Task 9 (Synthesise API + aiRouter) ─────── Task 10 (ThemeSynthesisPanel)
                                                          └─ Task 11 (Final build+push)
```
