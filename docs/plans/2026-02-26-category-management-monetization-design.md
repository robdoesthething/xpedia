# Category Management, AI Classification & Monetization Design

**Date**: 2026-02-26
**Status**: Approved

## Overview

This document covers three interconnected features:
1. User-controlled taxonomy management (create, edit, delete themes/collections, reset corpus)
2. Hybrid AI classification (AI classifies into user-defined structure; suggests taxonomy during onboarding)
3. Freemium monetization via one-time Stripe payment

---

## 1. Taxonomy Model

### Structure

Two-level hierarchy remains: **Themes → Collections → Tweets**

The fundamental change is ownership: users define the taxonomy, AI classifies into it.

### Onboarding (one-time setup)

On first login with no taxonomy, users see an **interest picker** before the dashboard:
- Grid of 12–15 hardcoded category chips
- User selects, renames inline, or adds custom themes
- Confirms → creates those Themes in their account
- Collections within themes are still created by AI as tweets are classified

### AI Classification (ongoing)

When a tweet arrives:
- AI prompt receives the user's theme list
- AI must classify into one of the existing themes
- AI still freely names the Collection within the chosen theme
- If confidence is low → tweet goes to **Uncategorized inbox**

### Uncategorized Inbox

- Pinned at the bottom of the theme sidebar as "Uncategorized (N)"
- Per-tweet dropdown to manually assign to any collection
- Pro users: "AI Sort All" button to batch-classify the inbox

### Delete & Reset

**Delete a Theme:**
- Modal: "Move collections to another theme" OR "Delete collections too"
- Tweets in deleted collections → Uncategorized

**Delete a Collection:**
- Tweets → Uncategorized

**Reset Corpus (Settings):**
- Red button, double-confirm dialog
- Wipes all Themes and Collections
- All tweets → Uncategorized (tweets are never deleted)
- Offers to re-run onboarding interest picker

---

## 2. Monetization

### Free Tier

| Feature | Limit |
|---------|-------|
| Tweet capture | Unlimited |
| Themes & Collections | Unlimited (manual creation) |
| Onboarding interest picker | Hardcoded suggestions only |
| AI auto-classification | ❌ |
| AI taxonomy suggestions | ❌ |
| Manual categorization | ✅ |
| Uncategorized inbox | ✅ |
| Reset corpus | ✅ |
| **AI synthesis (summary + conclusions)** | **1 collection, up to 5 tweets** |
| Markdown export | ❌ |

### Pro Tier (one-time payment, ~$19–29)

| Feature | Pro |
|---------|-----|
| AI-suggested categories (onboarding) | ✅ |
| AI auto-classification of all tweets | ✅ |
| AI synthesis on all collections | ✅ Unlimited |
| Theme-level synthesis (insights, key people) | ✅ |
| Bulk AI re-sort of uncategorized inbox | ✅ |
| Markdown export | ✅ |

### Enforcement Logic

- Free user triggers synthesis on a 2nd collection → lock modal with upgrade prompt
- Free user's AI collection exceeds 5 tweets → synthesis frozen, prompt: "Upgrade to synthesize more"
- Pro features show a lock icon; clicking any opens Stripe Checkout modal
- After successful payment → Stripe webhook updates `users.plan` to `'pro'`

### Payment

- **Stripe one-time checkout** (no subscription)
- Existing `plan: 'free' | 'pro'` field on `User` type is already in place
- Enforcement at API layer on all AI endpoints

---

## 3. UI Flows

### Pro Upgrade Flow

- Lock icon on every Pro feature
- Clicking any locked feature → one-time payment modal → Stripe Checkout
- On success: plan updates instantly via webhook, UI reflects Pro status

### Dashboard — Uncategorized Inbox

- Sidebar item: "Uncategorized (N)" pinned at bottom
- Tweet list with per-tweet collection assignment dropdown
- Pro: "AI Sort All" button

### Settings — Corpus Management

- "Corpus" section with destructive actions
- Delete Theme: inline from sidebar (right-click or kebab menu) → modal
- Reset Corpus: red button → double-confirm → optional re-run onboarding

---

## 4. User Onboarding (4 steps)

Progress indicator shown throughout.

### Step 1 — Welcome

- Headline: "Turn your bookmarks into a knowledge base."
- One-line explanation of how it works
- "Get started" CTA

### Step 2 — Install Extension

- Instruction card: install Chrome extension, pin it, open `x.com/bookmarks`
- Auto-skips if extension is already detected
- Short animation showing capture in action

### Step 3 — Build Your Taxonomy (Interest Picker)

Hardcoded chips (user can select, rename, or add custom):

- AI & Machine Learning
- Startups & Business
- Design & Creativity
- Programming & Dev Tools
- Finance & Investing
- Science & Research
- Health & Longevity
- Productivity & Focus
- Marketing & Growth
- Writing & Communication
- Philosophy & Ideas
- Current Events

**Free users**: select/rename/add only
**Pro users**: "+ AI Suggest" button calls AI for personalized suggestions

### Step 4 — Pick Your AI Collection (Free only)

- "Choose one collection to power with AI"
- Shows themes from step 3; user picks or creates a collection name
- Explanation: "Synthesis is unlimited on Pro — this gets you started"
- Pro users skip this step entirely

### Post-Onboarding

- Dashboard with dismissible "Capture your first tweets" empty state banner

---

## 5. API Changes Required

| Endpoint | Change |
|----------|--------|
| `GET /api/ai/suggest-categories` | New — returns AI-suggested theme names (Pro only) |
| `DELETE /api/themes/[id]` | New — with `orphan_action: 'move' | 'delete'` param |
| `DELETE /api/collections/[id]` | New — tweets → uncategorized |
| `POST /api/corpus/reset` | New — wipes taxonomy, keeps tweets |
| `POST /api/ai/sort-inbox` | New — batch classify uncategorized tweets (Pro only) |
| `POST /api/stripe/checkout` | New — create one-time Stripe Checkout session |
| `POST /api/stripe/webhook` | New — handle `checkout.session.completed`, update plan |
| `POST /api/ai/categorize` | Update — prompt includes user's theme list |

---

## 6. Data Model Changes

### `users` table (or `profiles`)

No change needed — `plan` field already exists.

### `users` — new columns

```sql
ALTER TABLE users
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN ai_collection_id uuid references collections(id) on delete set null;
-- ai_collection_id = the free user's one AI-synthesis slot
```

### Enforcement query (free tier)

```sql
-- Check if free user has used their AI slot
SELECT ai_collection_id FROM users WHERE id = $userId;
-- If ai_collection_id IS NOT NULL and != requested collection_id → block + prompt upgrade
-- If tweet_count in ai_collection_id >= 5 → block synthesis + prompt upgrade
```
