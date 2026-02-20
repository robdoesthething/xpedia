import {
  type AIProvider,
  CATEGORIZATION_PROVIDERS,
  SUMMARY_PROVIDERS,
  CONCLUSIONS_PROVIDERS,
  getAvailableProviders,
} from './ai-providers';

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
   * Accepts a rich tweet object to include thread, article, and image context.
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
    existingCollectionNames: string[]
  ): Promise<CategorizationResult | null> {
    const collectionsContext =
      existingCollectionNames.length > 0
        ? `Existing collections: ${existingCollectionNames.join(', ')}`
        : 'No existing collections yet.';

    const systemPrompt = `You categorize tweets into specific, actionable collections and write sharp one-line summaries.

Rules:
- Prefer assigning to an existing collection if the tweet fits.
- Only create a new collection if no existing one fits.
- Collection names must be SPECIFIC and ACTIONABLE — not vague categories.
  GOOD: "Pricing Strategy Tactics", "React Performance Patterns", "Cold Email Templates", "Fundraising Pitch Tips", "SQL Query Optimization"
  BAD: "Tech", "Business", "Programming", "Interesting Thoughts", "General Advice"
- Names should be 2-5 words, title-cased, and describe a skill or knowledge area someone would actively study.
- The summary must capture the SPECIFIC actionable insight, not just restate the topic.
  GOOD: "Use tiered pricing anchored to a decoy option to increase average deal size by 20-30%"
  BAD: "A tweet about pricing strategies"

${collectionsContext}

Respond with ONLY valid JSON: {"collection_name": "...", "summary": "..."}`;

    // Build the text portion of the user message
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

    // Build user message — add image blocks for Gemini if images present
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
