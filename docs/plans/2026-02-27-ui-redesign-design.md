# Xpedia UI/UX Redesign — Design Document

**Date**: 2026-02-27
**Status**: Approved
**Scope**: Landing page + full app UI
**Aesthetic direction**: Daniel Nguyen — playful & polished, indie-premium

---

## 1. Design Goals

The current design is cohesive and trustworthy (literary/scholarly aesthetic) but feels formal and introverted — it lacks the approachability and energy of indie hacker products. The goal is to:

- Keep the trust signal (clean, professional, organized)
- Add appeal and human energy (approachable, modern, maker-built)
- Establish a clear visual identity that feels distinctive and memorable

**Reference point**: Daniel Nguyen's products (Pika, etc.) — clean white surfaces, soft gradient mesh backgrounds, strong typographic hierarchy, vibrant but restrained accent colors.

---

## 2. Typography

### Font Stack

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display | **Syne** | 700, 800 | Hero headlines, section titles, collection names, large UI moments |
| Body / UI | **DM Sans** (keep existing) | 300, 400, 500 | Body copy, descriptions, navigation, form labels |
| Mono | **JetBrains Mono** (keep existing) | 400, 500 | Badges, metadata, labels, code |

### Rationale

- **Syne** is geometric and bold with strong personality at display sizes — creates memorable "indie built this" moments
- **DM Sans** is already in use and proven to work at small sizes in dense information layouts — no disruption
- Personality lives at **large sizes only** (headlines); invisible at body sizes = proper typographic hierarchy

### Hierarchy Patterns

```
Hero headline:     Syne 800, 56–72px, tight tracking (-0.02em)
Section titles:    Syne 700, 32–40px
Card titles:       Syne 600, 18–22px
Body copy:         DM Sans 400, 15px, line-height 1.6
Labels/captions:   JetBrains Mono 400, 11–12px, tracking-widest
```

---

## 3. Color System

### Palette — Indigo + Coral (split-complementary)

**Rationale**: Indigo signals intelligence, trust, and knowledge. Coral is warm and human — prevents the design from feeling cold or corporate. Split-complementary avoids the visual tension of true complementary pairs. Coral is used sparingly (CTAs only) so it never overstimulates.

### Semantic Tokens

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#FAFAF8` | `#0D0E1A` | Page background |
| `--surface` | `#FFFFFF` | `#161726` | Cards, panels, sidebars |
| `--surface-hover` | `#F4F4FD` | `#1E1F33` | Hover states on interactive surfaces |
| `--border` | `#E2E2F0` | `#2A2B45` | All borders and dividers |
| `--text` | `#0D0E1A` | `#F0F0FF` | Primary text |
| `--text-2` | `#6B6B8A` | `#9494B8` | Secondary / descriptive text |
| `--text-3` | `#9B9BB0` | `#5A5A7A` | Muted / metadata text |
| `--indigo` | `#5B5FFA` | `#5B5FFA` | Brand, links, active states, primary actions |
| `--indigo-hover` | `#4A4EF0` | `#6A6EFF` | Indigo hover state |
| `--indigo-muted` | `#EEF0FF` | `#1A1B3A` | Tag backgrounds, active nav background |
| `--coral` | `#FF6E4A` | `#FF7A5A` | Primary CTA buttons, key highlights |
| `--coral-hover` | `#F05A38` | `#FF8C6A` | Coral hover state |
| `--coral-muted` | `#FFF0EC` | `#2A1A14` | Alert tints, warm backgrounds |

### Usage Rules

- **Indigo**: navigation active states, links, tags, borders on focused inputs, secondary buttons
- **Coral**: primary CTA buttons, inbox/uncategorized badge counts (urgency), Pro upgrade accents
- **Never** use both indigo and coral on the same interactive element — they're for different action hierarchies
- Neutral surfaces (`--bg`, `--surface`) carry an indigo tint, not pure white/black — maintains warmth

---

## 4. Visual Effects

### Gradient Mesh Background (Hero + Auth pages)

Two soft radial blobs positioned at top-right and bottom-left:

```css
background:
  radial-gradient(ellipse 600px 400px at 80% -10%, rgba(91,95,250,0.15) 0%, transparent 70%),
  radial-gradient(ellipse 500px 500px at -10% 110%, rgba(124,58,237,0.10) 0%, transparent 70%),
  var(--bg);
```

No sharp edges, no high-saturation blobs — subtle atmosphere only.

### Cards

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 12px;
box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(91,95,250,0.05);
transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;

/* Hover */
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 8px 32px rgba(91,95,250,0.10);
border-color: rgba(91,95,250,0.30);
```

### Buttons

- **Primary (coral)**: `background: var(--coral)`, `border-radius: 8px`, hover: `scale(1.02)` + `brightness(1.05)`
- **Secondary (indigo)**: `border: 1.5px solid var(--indigo)`, `color: var(--indigo)`, transparent fill, hover: `background: var(--indigo-muted)`
- **Ghost**: No border, `color: var(--text-2)`, hover: `color: var(--text)`

### Badges / Tags

```css
background: var(--indigo-muted);
color: var(--indigo);
font-family: JetBrains Mono;
font-size: 11px;
letter-spacing: 0.08em;
border-radius: 999px;
padding: 2px 8px;
```

### Grain Texture Overlay (optional)

A very subtle CSS noise overlay (`opacity: 0.025`) on the `--bg` surface. Adds micro-depth, only visible on close inspection.

---

## 5. Landing Page

### Structure

```
┌─────────────────────────────────────┐
│  STICKY NAV                         │
│  Logo (Syne)  |  links  |  CTA btn  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  HERO  (gradient mesh background)   │
│                                     │
│  Badge: "AI-powered knowledge tool" │
│                                     │
│  Headline (Syne 800, large):        │
│  "Turn your bookmarks into a        │
│   knowledge corpus"                 │
│                                     │
│  Sub-headline (DM Sans):            │
│  "Xpedia automatically organizes    │
│   your X bookmarks into searchable  │
│   topic collections — ready to use  │
│   as LLM context."                  │
│                                     │
│  [Get started free]  [See how →]    │
│                                     │
│  Social proof: "Join 200+ builders" │
│  ●●●● avatar circles                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  PRODUCT SCREENSHOT                 │
│  Browser-frame mockup, drop shadow  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  STATS BAR (3 numbers)              │
│  10,000+ tweets  │  500+ collections│
│  Built by 1 person                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  FEATURES  (3-column grid)          │
│  Icon + headline + 1-line desc      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  HOW IT WORKS  (3 steps)            │
│  Large faded step numbers (Syne)    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  PRICING  (Free / Pro cards)        │
│  Pro card: indigo border + badge    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  FOOTER                             │
│  Logo + tagline + links             │
│  "Built by [name]" — indie sig      │
└─────────────────────────────────────┘
```

### Copy Direction

- Headlines: direct, no corporate speak ("Turn your bookmarks into a knowledge corpus" not "The ultimate bookmark management solution")
- CTAs: action-first ("Get started free", "See how it works")
- Social proof line: conversational ("Join 200+ knowledge builders")
- Footer: include maker attribution — this is the indie hacker signature

---

## 6. App UI Changes

### Sidebar

- Surface: `--surface` (`#161726` dark / white light) with `border-right: 1px solid var(--border)`
- Logo: Syne bold, indigo color
- Active nav item: `background: var(--indigo-muted)`, `border-left: 2px solid var(--indigo)`
- Inactive: `color: var(--text-2)`, hover: `color: var(--text)` + `background: var(--surface-hover)`
- Uncategorized inbox badge: coral pill with count

### Dashboard / Collection Cards

- Replace serif collection names with Syne medium
- Card: white surface + soft shadow + hover lift (see §4)
- Tweet count badge: indigo pill (JetBrains Mono)
- "New" / "Updated" badges: coral-muted background

### Page Headers

- Main headline (e.g., "Your Knowledge"): Syne 700, large
- Sub-description: DM Sans, `--text-2`

### Pro/Upgrade Elements

- ProLock wrapper: indigo badge
- ProUpgradeModal header: indigo gradient
- Upgrade CTA: coral button

### Empty States

- Simple centered SVG icon (abstract, not clipart)
- One line of copy in DM Sans, `--text-2`
- Optional: small coral CTA if there's a clear next action

### Form Elements

- Input focus ring: `outline: 2px solid var(--indigo)` (replaces old gold focus)
- Input background: `var(--surface)` (not `var(--bg)`)

---

## 7. Files to Change

### CSS / Tokens
- `src/app/globals.css` — replace all custom property tokens

### Fonts
- `src/app/layout.tsx` — replace Cormorant Garamond with Syne (keep DM Sans, JetBrains Mono)

### Landing Page
- `src/app/page.tsx` — full restructure with new sections

### App UI Components
- `src/components/Sidebar.tsx` (or equivalent sidebar component)
- `src/components/CollectionCard.tsx` (or equivalent)
- `src/components/ThemeToggle.tsx`
- `src/components/ThemeSynthesisPanel.tsx`
- Any modal components (ProUpgradeModal, OnboardingModal)
- `src/app/dashboard/page.tsx`

---

## 8. Out of Scope

- Chrome extension UI (separate concern)
- API routes / backend logic
- Database schema
- Authentication flow logic (UI tokens will update automatically via CSS variables)
