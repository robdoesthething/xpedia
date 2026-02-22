import {
  type AIProvider,
  CATEGORIZATION_PROVIDERS,
  SUMMARY_PROVIDERS,
  CONCLUSIONS_PROVIDERS,
  getAvailableProviders,
} from './ai-providers';
import { logAiCall } from './ai-logger';

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

${themesContext}
${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`;

    let textContent = `@${tweet.author_handle}: `;

    if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
      textContent += tweet.thread_content.map((t) => t.content).join('\n---\n');
    } else {
      textContent += tweet.content;
    }

    if (tweet.content_type === 'article') {
      if (tweet.article_title) textContent = `[Article: ${tweet.article_title}]\n` + textContent;
      if (tweet.article_description) textContent += `\n${tweet.article_description}`;
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
      thread_content?: { content: string }[] | null;
    },
    userId?: string
  ): Promise<string | null> {
    let rawText = tweet.content;
    if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
      rawText = tweet.thread_content.map((t) => t.content).join('\n---\n');
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
        content: `@${tweet.author_handle}: ${rawText}`,
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
      .map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You extract and preserve the most valuable knowledge from curated tweet collections.

Write a reference summary for the "${collectionName}" collection. Rules:
- Read every tweet carefully. If a tweet contains a reusable prompt, script, template, formula, or step-by-step process — quote it VERBATIM inside a blockquote (>). Do not paraphrase things that are more valuable in their original words.
- Surface specific techniques, exact numbers, named frameworks, and concrete examples — not vague descriptions of them.
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
      .map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You extract specific, actionable conclusions from curated tweet collections.

Given tweets in the "${collectionName}" collection, produce 3-7 conclusions. Rules:
- Each must be a specific action someone can take THIS WEEK — not vague advice.
- If a tweet contains a ready-to-use prompt, script, or template, include it verbatim inside the conclusion string (use quotes or a colon to introduce it). Do not summarize it away.
- Include concrete details: exact tools, numbers, steps, or named frameworks.
  GOOD: "Use the STAR framework when writing cold outreach: 'Situation → Task → Action → Result' — converts 3x better than feature-listing"
  BAD: "Write better cold emails"
  GOOD: "Run this ChatGPT prompt to audit your pricing page: [exact prompt from tweet]"
  BAD: "Use AI to improve your pricing"

Return ONLY a JSON array of strings: ["conclusion 1", "conclusion 2", ...]`,
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

};
