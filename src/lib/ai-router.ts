import {
  type AIProvider,
  CATEGORIZATION_PROVIDERS,
  SUMMARY_PROVIDERS,
  CONCLUSIONS_PROVIDERS,
  getAvailableProviders,
} from './ai-providers';
import { logAiCall } from './ai-logger';
import { sanitizeForPrompt } from './sanitize';

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string | MessageContent[];
}

interface CategorizationResult {
  theme_name: string;
  collection_name: string;
  summary: string;
  provider: string;
}

class RateLimitError extends Error {
  constructor(provider: string) {
    super(`Rate limited by ${provider}`);
    this.name = 'RateLimitError';
  }
}

/** Strip markdown code fences that some models wrap around JSON. */
function cleanJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function callProvider(
  provider: AIProvider,
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = process.env[provider.apiKeyEnvVar];
  if (!apiKey) throw new Error(`No API key for ${provider.name}`);

  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });

  if (res.status === 429) {
    throw new RateLimitError(provider.name);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`${provider.name} returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${provider.name} returned empty content`);

  return {
    content,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

async function callWithRotation(
  providers: AIProvider[],
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ content: string; provider: string; tokensIn: number; tokensOut: number } | null> {
  const available = getAvailableProviders(providers);
  if (available.length === 0) {
    console.warn('[AI] No providers available (no API keys configured)');
    return null;
  }

  for (const provider of available) {
    try {
      const { content, tokensIn, tokensOut } = await callProvider(provider, messages, maxTokens);
      return { content, provider: provider.name, tokensIn, tokensOut };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI] ${provider.name} failed: ${msg}`);
      if (err instanceof RateLimitError) {
        logAiCall({ provider: provider.name, operation: 'rate_limited', tokensIn: 0, tokensOut: 0 });
      }
    }
  }

  console.error('[AI] All providers failed');
  return null;
}

export const aiRouter = {
  /**
   * Categorize a tweet into a collection and generate a one-line summary.
   * Returns null on failure (tweet stays uncategorized).
   */
  async categorize(
    tweet: {
      content: string;
      author_handle: string;
      content_type?: string;
      image_urls?: string[];
      article_title?: string | null;
      article_description?: string | null;
      article_body?: string | null;
      thread_content?: { content: string }[] | null;
    },
    existingCollectionNames: string[],
    userId?: string,
    existingThemeNames: string[] = []
  ): Promise<CategorizationResult | null> {
    const themesContext =
      existingThemeNames.length > 0
        ? `Existing themes: ${existingThemeNames.join(', ')}`
        : 'No existing themes yet.';

    const collectionsContext =
      existingCollectionNames.length > 0
        ? `Existing collections: ${existingCollectionNames.join(', ')}`
        : 'No existing collections yet.';

    const systemPrompt = `You categorize tweets into collections under themes, and write a one-line actionable summary.

THEME: 2-4 words, broad. Reuse from existing list if possible.
COLLECTION: 2-5 words, title-cased, a studyable skill area. Reuse existing if it fits. Never vague ("Tech", "Business").

SUMMARY — the most important field:
- Start with an ACTION VERB (Add, Use, Implement, Switch, Set, Reduce, Run, Test, Apply, Build, Adopt, Create).
- Capture the CORE technique and its MEASURABLE RESULT.
- Copy ALL quantitative data verbatim: percentages (40%, 5x), dollar amounts ($38K), durations (2 hours, 7 days), counts (12 slides, 200 components), scores (8.2/10), and pixel/unit values (400px, 12KB).
- If the tweet has no specific technique or numbers, summarize the key mindset shift in one concrete sentence.

${themesContext}
${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`;

    const handle = sanitizeForPrompt(tweet.author_handle, 100);
    let textContent = `@${handle}: `;

    if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
      textContent += tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
    } else {
      textContent += sanitizeForPrompt(tweet.content);
    }

    if (tweet.content_type === 'article') {
      if (tweet.article_title) textContent = `[Article: ${sanitizeForPrompt(tweet.article_title, 200)}]\n` + textContent;
      if (tweet.article_description) textContent += `\n${sanitizeForPrompt(tweet.article_description, 500)}`;
      if (tweet.article_body) textContent += `\n\n--- Article body ---\n${sanitizeForPrompt(tweet.article_body, 1500)}`;
    }

    const images = tweet.image_urls?.slice(0, 3) ?? [];
    const userContent: string | MessageContent[] =
      images.length > 0
        ? [
          { type: 'text', text: textContent },
          ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ]
        : textContent;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    const result = await callWithRotation(CATEGORIZATION_PROVIDERS, messages, 200);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'categorize', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    try {
      const parsed = JSON.parse(cleanJson(result.content));
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
    } catch {
      console.error('[AI] Failed to parse categorization JSON:', result.content);
      return null;
    }
  },

  /**
   * Extract the most specific, reusable content from a single tweet verbatim.
   * Returns null on failure — caller should fall back to raw content.
   */
  async extractContent(
    tweet: {
      content: string;
      author_handle: string;
      content_type?: string;
      article_title?: string | null;
      article_description?: string | null;
      article_body?: string | null;
      thread_content?: { content: string }[] | null;
    },
    userId?: string
  ): Promise<string | null> {
    let rawText = sanitizeForPrompt(tweet.content);
    if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
      rawText = tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
    }
    if (tweet.content_type === 'article') {
      if (tweet.article_title) rawText = `[Article: ${sanitizeForPrompt(tweet.article_title, 200)}]\n` + rawText;
      if (tweet.article_description) rawText += `\n${sanitizeForPrompt(tweet.article_description, 500)}`;
      if (tweet.article_body) rawText += `\n\n--- Article body ---\n${sanitizeForPrompt(tweet.article_body, 1500)}`;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a content extraction engine. Read the tweet and pull out ONLY the most specific, reusable content.

Rules:
- If it contains a ready-to-use prompt → copy it word for word
- If it has a named framework with steps → list the exact steps
- If it has specific numbers, benchmarks, or formulas → include them precisely
- If it contains a script, template, or checklist → quote it exactly
- If the tweet is purely motivational or vague with no concrete takeaway → output exactly: "No specific content."
- DO NOT add commentary, paraphrase, or introduce the content. Output ONLY the extracted material.
- Max 200 words.`,
      },
      {
        role: 'user',
        content: `@${sanitizeForPrompt(tweet.author_handle, 100)}: ${rawText}`,
      },
    ];

    const result = await callWithRotation(CATEGORIZATION_PROVIDERS, messages, 300);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'extract', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    const extracted = result.content.trim();
    return extracted === 'No specific content.' ? null : extracted;
  },

  /**
   * Generate a summary paragraph for a collection based on its tweets.
   */
  async generateSummary(
    collectionName: string,
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<string | null> {
    const tweetBlock = tweets
      .map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You extract and preserve the most valuable knowledge from curated tweet collections.

Write a reference summary for the "${collectionName}" collection. Rules:
- Read every tweet carefully. If a tweet contains a reusable prompt, script, template, formula, or step-by-step process — quote it VERBATIM inside a blockquote (>). Do not paraphrase things that are more valuable in their original words.
- Surface specific techniques, exact numbers, named frameworks, and concrete examples — not vague descriptions of them.
- NEVER attribute to @handles or write "as shared by" / "as suggested by". Write the content as a reference document, not a list of who said what.
- Note points of consensus and any notable contrarian takes.
- Do NOT write in vague generalities. A reader should be able to act on this immediately.
- Length: as long as needed to capture everything valuable — do not truncate to seem concise.`,
      },
      {
        role: 'user',
        content: tweetBlock,
      },
    ];

    const result = await callWithRotation(SUMMARY_PROVIDERS, messages, 1200);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'summarize', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    return result.content.trim();
  },

  /**
   * Generate actionable conclusions from a collection's tweets.
   */
  async generateConclusions(
    collectionName: string,
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<string[] | null> {
    const tweetBlock = tweets
      .map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Distill these tweets into 5-7 actions someone can take THIS WEEK to improve their ${collectionName}.

RULES:
- Each action starts with an imperative verb (Raise, Add, Remove, Set, Test, Switch, Audit, Kill).
- Every action includes at least one specific number, formula, or framework from the tweets.
- Include complete frameworks — never say "use the framework" without listing its steps.
- NEVER reference @handles, sources, or authors. Output the substance, not attribution.
- Order from highest-impact to lowest-impact.

FORMAT: Each action should follow this pattern:
"[Verb] [specific action] — [expected measurable result]. [Any supporting detail or framework steps]."

Return ONLY a JSON array of strings: ["action 1", "action 2", ...]`,
      },
      {
        role: 'user',
        content: tweetBlock,
      },
    ];

    const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 800);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'conclude', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    try {
      const parsed = JSON.parse(cleanJson(result.content));
      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.error('[AI] Invalid conclusions response:', result.content);
        return null;
      }
      return parsed.map(String);
    } catch {
      console.error('[AI] Failed to parse conclusions JSON:', result.content);
      return null;
    }
  },
  /**
   * Identify the most valuable contributors to follow based on their tweets in this collection.
   */
  async generateKeyPeople(
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<{ handle: string; reason: string }[] | null> {
    const handles = [...new Set(tweets.map((t) => `@${sanitizeForPrompt(t.author_handle, 100)}`))].join(', ');
    const tweetBlock = tweets
      .map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`)
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

  async generateInsights(
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<string[] | null> {
    const tweetBlock = tweets.map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`).join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Synthesise a knowledge brief from curated tweets. Produce 5-8 insights in THREE tiers:

TIER 1 — CONSENSUS (things multiple sources agree on):
These are the strongest signals. Start each with "✅ ".

TIER 2 — STANDOUT TACTICS (unique techniques with proven results):
Specific techniques from individual sources with measured outcomes. Start each with "⚡ ".

TIER 3 — CONTRARIAN (ideas that challenge conventional wisdom):
Flag these explicitly. Start each with "⚠️ ".

RULES:
- Every insight includes specific numbers, frameworks, or quoted techniques.
- NEVER reference @handles or sources. Output the substance only.
- Order by impact within each tier.
- Include frameworks in full — never say "there's a framework" without listing its steps.

Return ONLY a JSON array of strings: ["✅ insight...", "⚡ insight...", "⚠️ insight...", ...]`,
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

  async generateDigest(
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<{ kta: string[]; new_voices: { handle: string; reason: string }[] } | null> {
    const tweetBlock = tweets.map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`).join('\n');

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
        new_voices: Array.isArray(parsed.new_voices)
          ? parsed.new_voices
            .filter((p: unknown) => p && typeof p === 'object' && 'handle' in p && 'reason' in p)
            .map((p: { handle: unknown; reason: unknown }) => ({
              handle: String(p.handle).replace(/^@/, ''),
              reason: String(p.reason),
            }))
          : [],
      };
    } catch {
      console.error('[AI] Failed to parse digest JSON:', result.content);
      return null;
    }
  },

};
