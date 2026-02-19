# Claude Development Guide for Tweet Corpus Builder (Codename: Xpedia)

This document provides context and best practices for AI assistants (Claude) working on the Tweet Corpus Builder codebase. Following these guidelines ensures consistency, quality, and efficient collaboration.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [Code Review & Refactoring Standards](#code-review--refactoring-standards)
- [TypeScript Conventions](#typescript-conventions)
- [Key Conventions](#key-conventions)
- [Important Files & Directories](#important-files--directories)
- [Common Patterns](#common-patterns)
- [Development Workflow](#development-workflow)
- [Multi-File Refactoring Checklist](#multi-file-refactoring-checklist)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)
- [Gotchas & Pitfalls](#gotchas--pitfalls)
- [Best Practices for Claude](#best-practices-for-claude)
  - [Core Behavioral Guidelines](#core-behavioral-guidelines)
  - [Think Before Coding](#1-think-before-coding)
  - [Simplicity First](#2-simplicity-first)
  - [Surgical Changes](#3-surgical-changes)
  - [Goal-Driven Execution](#4-goal-driven-execution)

## Project Overview

**Tweet Corpus Builder** (codename: Xpedia) is a tool that converts X (Twitter) bookmarks into a structured knowledge corpus. It automatically organizes bookmarks by topic using AI, generates summaries and actionable conclusions per collection, and exports Markdown documents ready for use as LLM context.

**Core Features**:

- Chrome extension captures bookmarks by reading the X DOM (no paid API)
- AI-powered automatic categorization into topic and project collections
- Living documents with summaries and actionable conclusions per collection
- Full-text search across the entire corpus
- One-click Markdown export for LLM context
- Freemium model with Stripe payments (Free + Pro plan)

**Current Version**: 0.1.0 (pre-MVP)

## Tech Stack & Architecture

### Frontend

- **React** with TypeScript
- **Next.js** (App Router) for full-stack framework
- **Tailwind CSS** for styling
- **Framer Motion** for animations

### Backend & Services

- **Next.js API Routes** - Backend logic
- **Supabase** - Primary database (PostgreSQL) + Auth
  - User profiles
  - Tweet storage & collections
  - AI-generated summaries & conclusions
- **Multi-provider AI rotation** - Groq, Cerebras, Gemini, SambaNova, OpenRouter, DeepSeek

### Chrome Extension

- **Manifest V3** (MV3)
- Reads DOM from `x.com/i/bookmarks`
- Sends captured tweets to the backend API

### State Management

- **React Context** for global state (auth, theme)
- **useReducer** for complex state
- Local state with `useState` for simple components

### File Structure

```
src/
├── app/              # Next.js App Router pages & API routes
│   ├── api/          # Backend API endpoints
│   │   ├── tweets/   # Tweet capture & management
│   │   ├── collections/ # Collection CRUD
│   │   └── ai/       # AI categorization & summarization
│   └── (routes)/     # Frontend pages
│       ├── dashboard/ # Main collections view
│       ├── collection/ # Single collection view
│       └── settings/  # User settings
├── components/       # Shared UI components
├── lib/              # Core utilities
│   ├── supabase.ts   # Supabase client
│   ├── ai-router.ts  # Multi-provider AI rotation
│   └── utils.ts      # General utilities
├── types/            # TypeScript definitions
└── chrome-extension/ # Chrome MV3 extension source
    ├── manifest.json
    ├── content.ts     # DOM scraping on x.com
    ├── background.ts  # Service worker
    └── popup.tsx      # Extension popup UI
```

## Code Review & Refactoring Standards

When performing code reviews or refactoring:

1. Group findings by category (rendering, data-fetching, bundle size, type safety)
2. Prioritize by impact: performance > correctness > maintainability > style
3. Always run `tsc --noEmit` after multi-file refactors to catch type errors
4. Run the test suite before and after changes to confirm no regressions

## TypeScript Conventions

- This is a TypeScript-first codebase. Always use TypeScript (.ts/.tsx) for new files.
- Prefer strict typing — avoid `any`. Use `unknown` + type guards when types are uncertain.
- After editing multiple files, run `tsc --noEmit` to verify type correctness.

## Key Conventions

### Code Style

1. **Tailwind Only**: No custom CSS unless absolutely necessary
2. **Z-index Scale**: Use 10, 20, 30, 40, 50 (increments of 10)
3. **Spacing**: Use gap-2, gap-4, gap-6 (avoid odd numbers)
4. **Component Props**: Maximum 5 props per component
5. **State Management**: Use `useReducer` for >3 related state values
6. **No Prop Drilling**: Beyond 2 levels, use Context

### Naming Conventions

**Files**:

- Components: `PascalCase.tsx` (e.g., `CollectionCard.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useCollections.ts`)
- Utils: `camelCase.ts` (e.g., `validation.ts`)
- Types: `types.ts` or `index.types.ts`
- API Routes: `route.ts` (Next.js convention)

**Variables & Functions**:

- `camelCase` for variables and functions
- `PascalCase` for React components
- `UPPER_SNAKE_CASE` for constants

**Database Tables** (Supabase):

- `snake_case` (e.g., `tweets`, `collections`, `ai_summaries`)

### Commit Messages

Follow Conventional Commits strictly:

```
type(scope): subject

feat(capture): add thread extraction support
fix(ai): handle rate limit rotation correctly
docs(readme): update installation steps
refactor(collections): extract sorting logic to hook
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Rules**:

- Subject must be lowercase
- Max 100 characters
- No trailing period
- Use imperative mood

## Important Files & Directories

### Core Configuration

- `package.json` - Dependencies and scripts
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind customization
- `.env.template` - Environment variable template
- `eslint.config.js` - Linting rules

### Key Source Files

**App Entry Points**:

- `src/app/layout.tsx` - Root layout
- `src/app/page.tsx` - Landing page

**API Routes**:

- `src/app/api/tweets/route.ts` - Tweet capture endpoint
- `src/app/api/collections/route.ts` - Collection CRUD
- `src/app/api/ai/categorize/route.ts` - AI categorization

**Core Libraries**:

- `src/lib/supabase.ts` - Supabase client initialization
- `src/lib/ai-router.ts` - Multi-provider AI rotation logic
- `src/lib/ai-providers.ts` - Provider configurations (Groq, Cerebras, etc.)

**Chrome Extension**:

- `src/chrome-extension/content.ts` - DOM scraping on x.com/bookmarks
- `src/chrome-extension/background.ts` - Service worker for API calls
- `src/chrome-extension/manifest.json` - MV3 manifest

## Common Patterns

### 1. Database Queries (Supabase)

Always handle errors and use proper typing:

```typescript
import { supabase } from '@/lib/supabase';

export async function getUserCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching collections:', error);
    return [];
  }

  return data;
}
```

**Key Points**:

- Always destructure `{ data, error }`
- Use `.single()` for one row, omit for multiple
- Add `[DB]` prefix to console logs
- Return `null` or empty array on error (don't throw)

### 2. AI Router Usage

Use the `AIRouter` class for all AI operations:

```typescript
import { aiRouter } from '@/lib/ai-router';

const result = await aiRouter.categorize(tweetContent, existingCollections);

// The router handles provider rotation, retries, and rate limits transparently
// result.collection — suggested collection name
// result.summary — one-line tweet summary
// result.provider — which provider was used (for logging)
```

**Never** call AI providers directly — always go through the router.

### 3. Authentication Checks (Supabase Auth)

Use Supabase Auth for server-side and client-side checks:

```typescript
// Server-side (API Route)
import { createClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... handle request
}
```

```typescript
// Client-side
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;
  if (!user) return <LoginPrompt />;

  return <div>Welcome {user.email}</div>;
}
```

### 4. Tweet Capture Flow

Chrome extension sends tweets to the backend:

```typescript
// Extension content script extracts tweets from DOM
const tweets = extractTweetsFromDOM();

// Sends to backend with deduplication
const response = await fetch('/api/tweets', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ tweets }),
});
```

### 5. Collection Document Generation

When new tweets are added, the collection document regenerates:

```typescript
// After adding tweets to a collection
await regenerateCollectionDocument(collectionId);

// This triggers:
// 1. Fetch all tweets in collection
// 2. AI generates updated summary
// 3. AI generates actionable conclusions
// 4. Update collection record in Supabase
```

### 6. Modal Components

All modals must have:

- Backdrop
- Close button
- ESC key handler
- AnimatePresence wrapper (for animations)

```typescript
<AnimatePresence>
  {showModal && (
    <Modal onClose={() => setShowModal(false)}>
      <Modal.Backdrop onClick={() => setShowModal(false)} />
      <Modal.Content>
        <Modal.CloseButton onClick={() => setShowModal(false)} />
        {/* content */}
      </Modal.Content>
    </Modal>
  )}
</AnimatePresence>
```

## Development Workflow

### Starting Work

1. **Always pull latest**:

   ```bash
   git pull origin main
   ```

2. **Check existing issues/branches**:
   - Don't duplicate work
   - Check `CHANGELOG.md` for recent changes

3. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Making Changes

1. **Read relevant docs first**:
   - This file (`CLAUDE.md`) for context
   - `PRD_TweetCorpusBuilder.md` for product requirements

2. **Follow the pattern**:
   - Find similar existing code
   - Match the style and structure
   - Don't reinvent patterns

3. **Test as you go**:

   ```bash
   npm run dev          # Run dev server
   npm run lint         # Check for errors
   npm run type-check   # TypeScript validation
   npm test             # Run tests
   ```

4. **Commit frequently**:
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

### Before Pushing

1. **Run all checks**:

   ```bash
   npm run lint
   npm run type-check
   npm test -- --run
   npm run format:check
   ```

2. **Build succeeds**:

   ```bash
   npm run build
   ```

3. **Review changes**:
   ```bash
   git diff
   git status
   ```

## Multi-File Refactoring Checklist

When making changes across 3+ files:

1. Read all affected files first before editing any
2. Make changes in dependency order (lib → components → pages)
3. Run type checker after all edits
4. Run tests if available
5. Summarize all changed files at the end

## Testing Strategy

### Unit Tests

Located in `__tests__` directories:

```typescript
// src/lib/__tests__/ai-router.test.ts
import { describe, it, expect } from 'vitest';
import { AIRouter } from '../ai-router';

describe('AIRouter', () => {
  it('should fallback to next provider on rate limit', async () => {
    // ...
  });
});
```

### Component Tests

Use React Testing Library:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CollectionCard from '../CollectionCard';

describe('CollectionCard', () => {
  it('should render collection name and tweet count', () => {
    render(<CollectionCard name="Software Architecture" tweetCount={12} />);
    expect(screen.getByText(/software architecture/i)).toBeInTheDocument();
  });
});
```

### E2E Tests

Playwright tests in `e2e/`:

```bash
npm run test:e2e       # Run E2E tests
npm run test:e2e:ui    # Interactive mode
```

## Deployment

### Deployment Checklist

- [ ] All tests pass
- [ ] Build succeeds
- [ ] No console errors in production build
- [ ] Environment variables set in Vercel
- [ ] Database migrations run (if needed)

## Gotchas & Pitfalls

### 1. Row Level Security (RLS)

**All Supabase tables have RLS enabled**.

If inserts/updates fail with "permission denied":

1. Verify RLS policies exist for that table
2. Ensure user is authenticated
3. Check that the policy matches the operation (SELECT, INSERT, UPDATE, DELETE)

### 2. AI Provider Rate Limits

Free tiers can change without notice. The `AIRouter` handles rotation, but be aware:

- Always check the `AIRouter` response for success/failure
- Log which provider was used for debugging
- If all providers fail, the operation should fail gracefully with a user-friendly message

### 3. Chrome Extension DOM Selectors

X can change their DOM structure at any time. Key selectors:

- `article[data-testid="tweet"]` — main tweet container
- If selectors break, tweets won't be captured — monitor for this

### 4. Thread Extraction Timing

Thread extraction opens background tabs and scrolls to load replies. This is async and can be slow:

- ~2-3 seconds per thread
- The extension should handle timeouts gracefully
- Users should see feedback that threads are being extracted

### 5. Supabase Auth + Next.js

Supabase Auth with Next.js requires proper cookie handling:

- Use `@supabase/ssr` for server-side auth
- Middleware refreshes tokens automatically
- Client and server Supabase clients are configured differently

### 6. Theme Handling

Theme state is in Context + localStorage:

```typescript
const { theme, setTheme } = useTheme();

// Values: 'light', 'dark', 'auto'
// 'auto' follows system preference
```

Always test in all three theme modes.

## Best Practices for Claude

### Core Behavioral Guidelines

These principles help reduce common AI coding mistakes. They bias toward caution over speed - use judgment for trivial tasks.

#### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- **State assumptions explicitly** - If uncertain, ask first
- **Present multiple interpretations** - If ambiguous, don't pick silently
- **Suggest simpler approaches** - Push back when warranted
- **Stop when confused** - Name what's unclear and ask

**Examples:**

✅ Good:

```
"I see two ways to implement this:
1. Add a new field to the existing table (simpler, but denormalizes data)
2. Create a join table (normalized, but adds complexity)

Which approach fits your architecture better?"
```

❌ Bad:

```
"I'll create a new join table for this."
(Silent assumption about architecture preference)
```

#### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

Rules:

- ❌ No features beyond what was asked
- ❌ No abstractions for single-use code
- ❌ No "flexibility" or "configurability" that wasn't requested
- ❌ No error handling for impossible scenarios
- ✅ If it takes 200 lines and could be 50, rewrite it

**Ask yourself:** "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**Examples:**

✅ Good (50 lines):

```typescript
// Direct implementation
function saveTweet(userId: string, tweet: CapturedTweet) {
  return supabase.from('tweets').insert({
    user_id: userId,
    content: tweet.content,
    author_handle: tweet.author,
    tweet_url: tweet.url,
  });
}
```

❌ Bad (200 lines):

```typescript
// Over-engineered with strategy pattern, factory, and config
class TweetSaveStrategy {
  constructor(private config: TweetSaveConfig) {}
  // ... 150 more lines of abstraction
}
```

#### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- ❌ Don't "improve" adjacent code, comments, or formatting
- ❌ Don't refactor things that aren't broken
- ✅ Match existing style, even if you'd do it differently
- ✅ If you notice dead code, mention it - don't delete it

When your changes create orphans:

- ✅ Remove imports/variables/functions that YOUR changes made unused
- ❌ Don't remove pre-existing dead code unless asked

**The test:** Every changed line should trace directly to the user's request.

**Examples:**

✅ Good:

```diff
// User asked: "Add collection name validation"
+ function validateCollectionName(name: string): boolean {
+   return name.length >= 1 && name.length <= 100;
+ }

  function createCollection(name: string) {
+   if (!validateCollectionName(name)) {
+     throw new Error('Invalid collection name');
+   }
    // existing code unchanged
  }
```

❌ Bad:

```diff
// User asked: "Add collection name validation"
+ function validateCollectionName(name: string): boolean {
+   return name.length >= 1 && name.length <= 100;
+ }

- function createCollection(name: string) {
+ async function createCollection(name: string): Promise<Collection> {
+   if (!validateCollectionName(name)) {
+     throw new Error('Invalid collection name');
+   }
-   const collection = { id: generateId(), name };
-   collections.push(collection);
-   return collection;
+   // Refactored to use await (not requested!)
+   const collection = await db.collections.create({ name });
+   return collection;
  }
```

#### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

**For multi-step tasks, state a brief plan:**

```
1. Add AI categorization test → verify: test fails as expected
2. Implement AIRouter.categorize() → verify: test passes
3. Run full test suite → verify: no regressions
```

Strong success criteria let you work independently. Weak criteria ("make it work") require constant clarification.

**Examples:**

✅ Good:

```
"I'll fix the tweet deduplication bug with these verifiable steps:

1. Add debug logging to identify the duplicate check logic
   → Verify: Console shows exact tweet URL used in comparison

2. Fix the deduplication query to normalize URLs
   → Verify: Console shows consistent URL format

3. Test that duplicate tweets are rejected
   → Verify: POST /api/tweets returns 200 with duplicates filtered

4. Remove debug logging
   → Verify: Clean console in production build

Each step has a clear success check."
```

❌ Bad:

```
"I'll fix the deduplication bug."
(No clear verification steps or success criteria)
```

---

### When Starting a Task

1. **Ask clarifying questions** if requirements are unclear
2. **Check existing code** for similar patterns
3. **Read relevant documentation** before proposing solutions
4. **Search the codebase** to understand current implementation
5. **Consider backwards compatibility** - don't break existing features

### When Writing Code

1. **Match existing patterns** - consistency > cleverness
2. **Add logging** for debugging (use appropriate prefixes like `[DB]`, `[Auth]`, `[AI]`, `[Capture]`)
3. **Handle errors gracefully** - don't throw, return null/empty
4. **Type everything** - avoid `any` types
5. **Keep functions small** - single responsibility
6. **Comment complex logic** - but prefer self-documenting code

### When Reviewing Changes

1. **Test in dev mode** first
2. **Check console** for errors/warnings
3. **Verify type safety** with `npm run type-check`
4. **Run linter** with `npm run lint`
5. **Check git diff** before committing
6. **Write clear commit messages** following Conventional Commits

### Communication with User

1. **Explain the "why"** not just the "what"
2. **Show file paths** for code locations (e.g., `src/app/api/tweets/route.ts:42`)
3. **Highlight breaking changes** clearly
4. **Provide migration steps** if needed
5. **Link to relevant docs** when referencing standards

### When Stuck

1. **Search existing issues** in the codebase
2. **Check git history** for related changes
3. **Review recent commits** for context
4. **Ask the user** for clarification
5. **Propose multiple solutions** with tradeoffs

### Red Flags to Watch For

❌ **Don't**:

- Make assumptions about user preferences
- Skip error handling
- Ignore TypeScript errors
- Mix different patterns in same file
- Add dependencies without asking
- Modify build config without reason
- Change database schema without migration plan
- Break existing tests
- Commit commented-out code
- Use `console.log` for production logging

✅ **Do**:

- Ask questions when unclear
- Follow existing patterns
- Add tests for new features
- Handle edge cases
- Update documentation
- Consider performance
- Think about mobile users
- Check accessibility
- Verify browser compatibility
- Clean up temporary code

## Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix lint errors
npm run type-check       # TypeScript check
npm run format           # Format with Prettier
npm run format:check     # Check formatting

# Testing
npm test                 # Run unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # E2E tests
```

### Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers
GROQ_API_KEY=
CEREBRAS_API_KEY=
GOOGLE_AI_API_KEY=
SAMBANOVA_API_KEY=
DEEPSEEK_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Key URLs

- Production: (TBD — Vercel deployment)
- GitHub: (TBD)
- Supabase Dashboard: (project-specific)

---

## Summary

This guide should help you work efficiently on Tweet Corpus Builder. Key principles:

1. **Consistency** - Follow existing patterns
2. **Quality** - Test thoroughly, handle errors
3. **Documentation** - Update docs when needed
4. **Communication** - Ask questions, explain changes
5. **User Focus** - Consider UX in every decision

When in doubt, ask the user or check existing code for similar examples.

---

## Summary: Guidelines in Action

These guidelines are **working** if you see:

✅ **Fewer unnecessary changes** in diffs
✅ **Fewer rewrites** due to overcomplication
✅ **Clarifying questions** before implementation (not after mistakes)
✅ **Focused PRs** where every change traces to the user's request
✅ **Self-verifying code** with clear success criteria

**Remember:**

1. **Think** → Ask questions, surface tradeoffs, state assumptions
2. **Simplify** → Minimum code, no speculation, no premature abstraction
3. **Surgical** → Touch only what's needed, match existing style
4. **Verify** → Define success criteria, test each step

When in doubt: **Ask** > Assume, **Simple** > Clever, **Focused** > Comprehensive

---

**Last Updated**: February 19, 2026
