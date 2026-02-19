# PRD — Tweet Corpus Builder

**Version:** 1.3
**Date:** February 2026
**Author:** Roberto (Turtle Capital)

> **Note:** "Tweet Corpus Builder" is a working name. Final branding is TBD.

---

## 1. Product Vision

Tweet Corpus Builder is a personal tool that turns X bookmarks into a structured knowledge corpus, automatically organized by AI and exportable as Markdown documents ready to use as context for language models.

The user doesn't change any habit: they keep saving tweets on X as usual. The app does the rest.

---

## 2. Problem

X users accumulate hundreds of valuable bookmarks — threads about programming, strategy, investing, product — but that knowledge gets trapped in a flat, useless list. It's not organized, not searchable, and can't be used directly as input for working with AI.

The result: knowledge is lost.

---

## 3. Solution

A Chrome extension + web app that:

1. **Captures** X bookmarks by reading the DOM directly (no paid API)
2. **Automatically categorizes** each tweet using AI
3. **Generates and enriches documents** by topic and by project, with summaries and actionable conclusions
4. **Exports** in Markdown ready to paste into Claude, GPT, or any LLM

---

## 4. Target User

**Primary user (MVP):** Roberto himself — developer/analyst who consumes technical and business content on X and needs to organize it for use in programming projects and investment analysis.

**Secondary user (post-MVP):** Builders, PMs, analysts, and investors who use X as a knowledge source and regularly work with AI.

---

## 5. Competitive Landscape

### Twillot — Detailed Feature Analysis

Twillot is the most direct competitor. Full feature list as of early 2025 (should be re-verified for current state):

**Bookmark Management**

- Local sync of bookmarks, likes, and own tweets
- Folders and color-coded tags (drag & drop)
- Mass delete of bookmarks, likes, and posts
- Bypasses X's 1,000 bookmark limit by syncing locally

**Search**

- Full-text search by keyword, date range, folder, username
- Browser Omnibox search (shortcut `tt`)

**AI**

- Auto-categorization by topic, sentiment, and context
- Pro plan: 500 bookmarks/day with automatic categorization

**Export**

- CSV, JSON, Markdown, PDF
- Integration with Notion, Obsidian, Google Drive, GitHub
- Bulk media download (photos, videos, GIFs)

**Extras**

- Ad blocker on timeline
- Mass unfollow / block / unblock
- X lists management
- GitHub-contributions-style activity visualization

**Pricing:** Free with limits + Pro (price not publicly listed)
**Active users:** ~2,000 (early 2025) — validated but small market, plenty of room

### What Twillot Does NOT Do (Our Differentiator)

| Feature                            | Twillot      | Tweet Corpus Builder |
| ---------------------------------- | ------------ | -------------------- |
| Export raw tweets                  | ✅           | ✅                   |
| AI categorization                  | ✅ (folders) | ✅ (collections)     |
| Synthesis summaries per collection | ❌           | ✅                   |
| Actionable conclusions             | ❌           | ✅                   |
| Living document, auto-updated      | ❌           | ✅                   |
| Oriented as input for AI           | ❌           | ✅                   |
| Collections by user project        | ❌           | ✅                   |

The positioning is clear: Twillot is an **archive**. Our product is a **knowledge engine**.

### Twillot Features Worth Incorporating

The following Twillot features make sense to add to the roadmap given their proven utility:

- **Omnibox search** (quick keyboard shortcut) → Post-MVP
- **Bulk media download** alongside the tweet → Post-MVP
- **Activity visualization** (tweets captured per day/week) → Post-MVP
- **Export to Notion/Obsidian** in addition to native Markdown → Post-MVP
- **Ad blocker on X** → Free feature that drives engagement

### Other Competitors

**Circleboom Twitter** — Official X partner, more enterprise-oriented, expensive. Not a threat to the indie/builder segment.

**Tweetsmash / Dewey** — Lightweight extensions for basic digest and organization. No AI synthesis or documents.

### Competitive Validation

Twillot's existence confirms two critical things: the market exists and pays, and the DOM-reading technology for X works in production (including threads). There's no unproven technical risk.

---

## 6. User Flow

```
User opens x.com/i/bookmarks
        ↓
Chrome extension detects the page and reads the DOM
        ↓
Extracts: author, text, date, URL of each visible tweet
        ↓
Sends to backend (automatically deduplicated)
        ↓
AI analyzes the content and assigns collection + generates summary
        ↓
The document for that collection updates automatically
        ↓
User opens the web app when they want to review or export
```

The user only needs to open their bookmarks page occasionally. Everything else is automatic.

---

## 7. Features — MVP

### 7.1 Chrome Extension

- Activates automatically on `x.com/i/bookmarks`
- Reads the DOM and extracts tweets without needing X's API using the selector `article[data-testid="tweet"]`
- **Thread support:** when it detects a tweet that's part of a thread, opens the tweet URL in the background, scrolls to load replies from the same author, extracts the full sequence, and closes the tab. The user doesn't see it. Additional latency: ~2-3 seconds per thread.
- **X articles (long-form) support:** articles are standard web pages within `x.com` — the full content of the `article` HTML is extracted without additional complexity.
- Sends tweets to the backend with the authenticated user's token
- Deduplicates: doesn't send already-saved tweets
- Works in the background without interrupting browsing
- Shows a badge with the number of new tweets captured

### 7.2 AI System with Free Model Rotation

The system rotates between providers with free tiers to keep cost at $0 during the MVP and early growth phase. All providers use the OpenAI-compatible API format, so switching providers is trivial in code (only `baseURL` and `apiKey` change).

**Rotation stack (priority order):**

| Provider             | Model                 | Free Tier Limit       | Role                               |
| -------------------- | --------------------- | --------------------- | ---------------------------------- |
| **Groq**             | Llama 3.3 70B         | ~30 RPM, 100K TPD     | Primary — fastest                  |
| **Cerebras**         | Llama 3.3 70B         | ~30 RPM, ~1M TPD      | Secondary — fast, high volume      |
| **Google AI Studio** | Gemini 2.0 Flash      | 15 RPM, 1,500 RPD     | Tertiary — large context           |
| **SambaNova**        | Llama 3.1 405B        | ~10 RPM               | Quaternary — highest quality free  |
| **OpenRouter**       | Free models (various) | ~200 req/day          | Emergency fallback                 |
| **DeepSeek**         | DeepSeek V3           | Paid (~$0.27/M input) | Last resort if all free tiers fail |

**Rotation logic:**

```
1. Try primary provider (Groq)
2. If 429 error (rate limit) → next provider
3. If all free tiers exhausted → DeepSeek V3 (paid, minimal cost)
4. Log usage per provider in Supabase to optimize rotation
```

**Estimated total free capacity:** ~20,000+ req/day combined, sufficient for ~400 daily active users at zero cost. Above that threshold, DeepSeek V3 covers the overflow at minimal cost.

**Implementation:** An `AIRouter` class in the backend manages rotation, exposes a single `categorize(tweet, collections)` method, and handles retries transparently. The rest of the system doesn't know which provider was used.

**AI tasks differentiated by model:**

- **Individual tweet categorization** → Groq / Cerebras (fast, simple task)
- **Collection summary regeneration** → Gemini Flash (long context, less urgent)
- **Actionable conclusions generation** → SambaNova or DeepSeek (higher synthesis quality)

**Risk note:** Free tiers can change without notice (Google cut Gemini limits ~80% in Dec 2025). The rotation architecture mitigates this — if a provider changes limits, its priority is adjusted in config without touching the rest of the code.

### 7.3 Generated Documents

Each collection generates and maintains a living document with this structure:

```markdown
# [Collection Name]

Last updated: [date] | [N] tweets

## Summary

[Paragraph synthesizing the accumulated knowledge in this collection,
generated and updated by AI each time new tweets come in]

## Actionable Conclusions

- [Conclusion 1]
- [Conclusion 2]
- [Conclusion 3]

## Sources

### @author — [date]

> [Tweet or thread text]
> URL: [url]
```

Documents are regenerated automatically when new tweets enter that collection.

### 7.4 Collection Types

- **By topic:** automatically created by AI (e.g., "Software Architecture", "Growth Hacking", "Private Equity")
- **By project:** manually created by the user (e.g., "Tweet Corpus Builder", "Girify") — tweets are assigned to projects if the user indicates a tweet is relevant to that project

### 7.5 Web App

- View of all collections with tweet count and last updated date
- Document view: summary + conclusions + source tweets
- Full-text search within the corpus
- Manually move tweets between collections
- Export collection as `.md`
- Copy document to clipboard with one click

### 7.6 Authentication

- Login with email + password via Supabase Auth
- Each user only sees their own data (Row Level Security in PostgreSQL)

---

## 8. Features — Post-MVP

**From the original roadmap**

- Automatic periodic sync without needing to manually open bookmarks
- Safari extension (iOS/macOS)
- Weekly summary email: "This week you saved X tweets about Y"
- Merge similar collections detected by AI
- Own API for external integrations
- Multi-language support for categorization

**Inspired by Twillot gaps**

- **Export to Notion and Obsidian** — direct integration beyond native Markdown
- **Media download** (images, videos) attached to saved tweets
- **Activity dashboard** — GitHub-contributions-style visualization of tweets captured per day
- **Ad blocker on X** — free high-perceived-value feature that drives adoption

**New — doesn't exist in any competitor**

- **Chat with your corpus** — chat window where you can ask questions about accumulated knowledge ("what do my bookmarks say about microservices architecture?") using RAG over the documents
- **Cross-collection connections** — AI detects tweets in different collections discussing the same topic and links them
- **Project mode** — when creating a project, the user can indicate which topic collections are relevant and the system generates a mega-context document specific to that project
- **Weekly AI digest** — automatic email with "The 3 most important insights you saved this week" generated by AI
- **Import from other sources** — add tweets manually by URL, or import from Readwise/Pocket

---

## 9. Tech Stack

| Layer              | Technology                           | Justification                                |
| ------------------ | ------------------------------------ | -------------------------------------------- |
| Frontend           | React + Tailwind CSS                 | Proven, known stack                          |
| Backend            | Next.js API Routes                   | Full-stack in a single codebase              |
| Database           | Supabase (PostgreSQL)                | Free on MVP, powerful SQL, RLS included      |
| Auth               | Supabase Auth                        | Integrated with the DB                       |
| Capture            | Chrome Extension (MV3)               | No dependency on X's API                     |
| AI — free rotation | Groq + Cerebras + Gemini + SambaNova | $0 up to ~400 users/day                      |
| AI — paid fallback | DeepSeek V3                          | ~$0.27/M input tokens if free tier exhausted |
| Hosting            | Vercel                               | Free on MVP, automatic CI/CD                 |
| Payments           | Stripe                               | Standard, easy to integrate                  |

---

## 10. Data Model

```sql
users
  id, email, plan, created_at

collections
  id, user_id
  name, type (topic | project)
  description
  ai_summary          -- AI-generated summary
  ai_conclusions      -- array of actionable conclusions
  summary_updated_at
  tweet_count
  created_at, updated_at

tweets
  id, user_id, collection_id
  tweet_url, author_handle, author_name
  content
  thread_content      -- JSON array with thread tweets
  ai_summary          -- one-line summary of the tweet
  tweet_date
  captured_at
```

---

## 11. Privacy and Security

- The extension only activates on `x.com` and only has read permission
- Tweets are public X content — no private user information from X is stored
- Row Level Security in Supabase: impossible for one user to access another's data at the database level
- Tweets are sent to AI providers only for categorization, with no personal user data included in the prompt
- Terms of use will explicitly inform that tweet content is processed by an external AI model

---

## 12. Cost Structure

| Users       | Vercel    | Supabase  | AI (free rotation)            | Total          |
| ----------- | --------- | --------- | ----------------------------- | -------------- |
| 0–400       | $0        | $0        | **$0** (free tiers)           | **~$0/month**  |
| 400–1,000   | $0        | $25/month | ~$5/month (DeepSeek overflow) | **~$30/month** |
| 1,000–2,500 | $20/month | $25/month | ~$20/month                    | **~$65/month** |

---

## 13. Monetization

**Free Plan**

- Up to 100 saved tweets
- Up to 5 collections
- Basic export

**Pro Plan — €8/month**

- Unlimited tweets and collections
- Automatic AI-generated summaries and conclusions
- Full-text search
- Advanced export
- Manual document regeneration

---

## 14. Build Roadmap

### Week 1 — Foundation

- Supabase setup: schema, Auth, RLS
- Basic web app: login, empty collections view, navigation structure

### Week 2 — Capture

- Chrome extension: DOM reading from x.com/bookmarks
- Backend endpoint to receive and deduplicate tweets
- Tweet view in the web app

### Week 3 — AI

- AI router integration: automatic categorization upon receiving tweets
- Collection summary and conclusion generation
- Automatic document regeneration when new tweets are added

### Week 4 — Complete Product

- Markdown export
- Full-text search
- Stripe (Pro plan)
- UX polish

### Post-launch

- Feedback from first users
- Iteration based on real usage
- Evaluate Safari extension

---

## 15. Success Metrics (MVP)

- Roberto himself uses the app daily for 2 consecutive weeks
- Automatic categorization is correct in >80% of cases without manual intervention
- Time from opening bookmarks to having categorized tweets: <30 seconds
- At least 5 external paying users in the first month after launch

---

## 16. What This Product Is NOT

- Not a tweet reader or alternative feed
- Does not replace X or compete with it
- Does not share data between users
- Does not require the user to change any habit on X
- Does not depend on X's official API (no API costs, no risk from ToS changes)
