import {
  type AIProvider,
  CATEGORIZATION_PROVIDERS,
  SUMMARY_PROVIDERS,
  CONCLUSIONS_PROVIDERS,
  getAvailableProviders,
} from './ai-providers';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface CategorizationResult {
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
): Promise<string> {
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
  return content;
}

async function callWithRotation(
  providers: AIProvider[],
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ content: string; provider: string } | null> {
  const available = getAvailableProviders(providers);
  if (available.length === 0) {
    console.warn('[AI] No providers available (no API keys configured)');
    return null;
  }

  for (const provider of available) {
    try {
      const content = await callProvider(provider, messages, maxTokens);
      return { content, provider: provider.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI] ${provider.name} failed: ${msg}`);
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
    content: string,
    authorHandle: string,
    existingCollectionNames: string[]
  ): Promise<CategorizationResult | null> {
    const collectionsContext =
      existingCollectionNames.length > 0
        ? `Existing collections: ${existingCollectionNames.join(', ')}`
        : 'No existing collections yet.';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You categorize tweets into topic collections and write one-line summaries.

Rules:
- Prefer assigning to an existing collection if the tweet fits.
- Only create a new collection if no existing one fits. New names should be short (2-4 words), title-cased topic labels (e.g. "Software Architecture", "AI Research", "Startup Advice").
- The summary should be one concise sentence capturing the tweet's key insight.

${collectionsContext}

Respond with ONLY valid JSON: {"collection_name": "...", "summary": "..."}`,
      },
      {
        role: 'user',
        content: `@${authorHandle}: ${content}`,
      },
    ];

    const result = await callWithRotation(CATEGORIZATION_PROVIDERS, messages, 150);
    if (!result) return null;

    try {
      const parsed = JSON.parse(cleanJson(result.content));
      if (!parsed.collection_name || !parsed.summary) {
        console.error('[AI] Invalid categorization response:', result.content);
        return null;
      }
      return {
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
   * Generate a summary paragraph for a collection based on its tweets.
   */
  async generateSummary(
    collectionName: string,
    tweets: { author_handle: string; content: string }[]
  ): Promise<string | null> {
    const tweetBlock = tweets
      .map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You write concise, insightful summaries for topic collections of curated tweets.

Write a 2-4 paragraph summary that synthesizes the key themes and insights across all tweets in the "${collectionName}" collection. Focus on recurring patterns, consensus views, and notable contrarian takes. Do not list individual tweets — synthesize.`,
      },
      {
        role: 'user',
        content: tweetBlock,
      },
    ];

    const result = await callWithRotation(SUMMARY_PROVIDERS, messages, 600);
    if (!result) return null;
    return result.content.trim();
  },

  /**
   * Generate actionable conclusions from a collection's tweets.
   */
  async generateConclusions(
    collectionName: string,
    tweets: { author_handle: string; content: string }[]
  ): Promise<string[] | null> {
    const tweetBlock = tweets
      .map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You extract actionable conclusions from curated tweet collections.

Given tweets in the "${collectionName}" collection, produce 3-7 actionable conclusions. Each should be a concrete, practical takeaway someone can act on. Return ONLY a JSON array of strings: ["conclusion 1", "conclusion 2", ...]`,
      },
      {
        role: 'user',
        content: tweetBlock,
      },
    ];

    const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 400);
    if (!result) return null;

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
};
