import { logAiCall } from './ai-logger';
import {
  type AIProvider,
  CATEGORIZATION_PROVIDERS,
  CONCLUSIONS_PROVIDERS,
  getAvailableProviders,
  SUMMARY_PROVIDERS,
} from './ai-providers';
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

/** Format an array of tweets as a numbered list for AI prompts. */
function formatTweetBlock(tweets: { author_handle: string; content: string }[]): string {
  return tweets
    .map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`)
    .join('\n');
}

/**
 * Post-process AI insight text to strip unverified metric claims.
 * Uses Unicode escapes for dash characters to avoid encoding issues.
 */
function stripMetricClaims(text: string): string {
  // Dash character class: em-dash (U+2014), en-dash (U+2013), hyphen-minus
  const D = '[\u2014\u2013\\-]';
  return text
    // "— expected measurable result: ..." or "— expected result: ..." or "— expected outcome: ..."
    .replace(new RegExp(`\\s*${D}+\\s*expected\\s+[^.]*\\.`, 'gi'), '.')
    // Any dash followed by text containing a percentage: "— 25% improvement in X."
    .replace(new RegExp(`\\s*${D}+\\s*[^.]*\\d+%[^.]*\\.`, 'gi'), '.')
    // Any dash followed by a dollar amount: "— $5,000 potential value."
    .replace(new RegExp(`\\s*${D}+\\s*\\$[\\d,]+[^.]*\\.`, 'gi'), '.')
    // Any dash followed by Nx multiplier: "— 3x faster."
    .replace(new RegExp(`\\s*${D}+\\s*\\d+x\\s+[^.]*\\.`, 'gi'), '.')
    // Standalone "expected measurable result:" anywhere (no dash needed)
    .replace(/expected measurable result:[^.]*/gi, '')
    // Standalone dollar amounts like "$5,000" anywhere
    .replace(/\$[\d,]+(?:\.\d+)?(?:\s*(?:potential|value|worth|budget|cost|ROI|per|\/M)[^,.]*)*/gi, '')
    // Standalone percentage claims: "100% hit rate", "90% success rate"
    .replace(/\d+%\s+(?:success rate|hit rate|improvement|increase|decrease|reduction|accuracy|effectiveness|failure rate)[^,.]*/gi, '')
    // Clean up orphaned double spaces and punctuation
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/:\s*\./g, '.')
    .replace(/\s+\./g, '.')
    .replace(/ {2,}/g, ' ')
    .trim();
}


/**
 * Parse and clean JSON from an AI response.
 * Returns null (and logs) if parsing fails.
 */
function parseAiJson<T>(raw: string, operationName: string): T | null {
  try {
    return JSON.parse(cleanJson(raw)) as T;
  } catch {
    console.error(`[AI] Failed to parse ${operationName} JSON:`, raw);
    return null;
  }
}
/**
 * Returns the main text body of a tweet: thread content joined by separators,
 * or the raw content for plain tweets. Applies sanitization.
 */
function buildRichTweetText(tweet: {
  content: string;
  content_type?: string;
  thread_content?: { content: string }[] | null;
}): string {
  if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
    return tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
  }
  return sanitizeForPrompt(tweet.content);
}
async function callProvider(
  provider: AIProvider,
  messages: ChatMessage[],
  maxTokens: number,
  temperature = 0.2
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
      temperature,
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
  maxTokens: number,
  temperature = 0.2
): Promise<{ content: string; provider: string; tokensIn: number; tokensOut: number } | null> {
  const available = getAvailableProviders(providers);
  if (available.length === 0) {
    console.warn('[AI] No providers available (no API keys configured)');
    return null;
  }

  for (const provider of available) {
    try {
      const { content, tokensIn, tokensOut } = await callProvider(provider, messages, maxTokens, temperature);
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
    const themeInstruction =
      existingThemeNames.length > 0
        ? `THEME: You MUST assign exactly one of these themes: ${existingThemeNames.join(', ')}. Do NOT invent a new theme. If the content does not clearly fit any theme, use "__uncategorized__".`
        : 'THEME: 2-4 words, broad (e.g. "AI & Machine Learning", "Finance & Investing").';

    const collectionsContext =
      existingCollectionNames.length > 0
        ? `Existing collections (reuse if it fits): ${existingCollectionNames.join(', ')}`
        : 'No existing collections yet.';

    const systemPrompt = `You categorize tweets into collections under themes, and write a one-line actionable summary.

${themeInstruction}
COLLECTION: 2-5 words, title-cased, a studyable skill area. Reuse existing if it fits. Never vague ("Tech", "Business").

SUMMARY — the most important field:
- Start with an ACTION VERB (Add, Use, Implement, Switch, Set, Reduce, Run, Test, Apply, Build, Adopt, Create).
- Capture the CORE technique and its MEASURABLE RESULT.
- Copy ALL quantitative data verbatim: percentages (40%, 5x), dollar amounts ($38K), durations (2 hours, 7 days), counts (12 slides, 200 components), scores (8.2/10), and pixel/unit values (400px, 12KB).
- If the tweet has no specific technique or numbers, summarize the key mindset shift in one concrete sentence.

${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`;

    const handle = sanitizeForPrompt(tweet.author_handle, 100);
    let textContent = `@${handle}: ${buildRichTweetText(tweet)}`;

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

    const parsed = parseAiJson<{ theme_name: string; collection_name: string; summary: string }>(
      result.content, 'categorization'
    );
    if (!parsed?.theme_name || !parsed.collection_name || !parsed.summary) {
      console.error('[AI] Invalid categorization response:', result.content);
      return null;
    }
    return {
      theme_name: String(parsed.theme_name).trim(),
      collection_name: String(parsed.collection_name).trim(),
      summary: String(parsed.summary).trim(),
      provider: result.provider,
    };
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
    let rawText = buildRichTweetText(tweet);
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
- If the tweet references a resource (article, video, tool) without providing its content inline → extract only the resource name, URL, and one-line description of what it covers. Do not speculate about its contents.
- If the tweet is spam, a scam, purely promotional with no substance, or motivational fluff with no concrete takeaway → output exactly: "SKIP"
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
    const skip = extracted.toUpperCase() === 'SKIP' || extracted === 'No specific content.';
    return skip ? null : extracted;
  },

  /**
   * Generate a summary paragraph for a collection based on its tweets.
   */
  async generateSummary(
    collectionName: string,
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<string | null> {
    const tweetBlock = formatTweetBlock(tweets);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You produce a concise knowledge brief from curated tweets. Your output will be used as reference material for LLMs working on related tasks.

Write a reference brief for the "${collectionName}" collection.

STRUCTURE (use exactly these sections, skip any that would be empty):

### Key Techniques & Frameworks
Concrete methods, step-by-step processes, named frameworks. Quote verbatim when the original phrasing is more precise than a paraphrase. Use blockquotes (>) for direct quotes.

### Numbers & Benchmarks
All quantitative data: percentages, dollar amounts, durations, counts, scores. Present as a bullet list.

### Tools & Resources
Specific tools, libraries, APIs, or resources mentioned with what they do. DO NOT append generic descriptions like "for coding" if not explicitly detailed in the tweets.

### Open Questions & Gaps
What the collection does NOT cover that a practitioner would need. ONLY list gaps that are glaringly obvious from the context. DO NOT invent generic questions like "How to integrate X with Y". If no obvious gaps exist, skip this section.

ABSOLUTE RULES:
- NEVER use hedging language: "appears to", "could imply", "it's unclear", "seems to suggest". State facts or omit.
- NEVER mention what's missing from tweets ("the list was not provided", "no framework was named"). If a tweet references something without providing it, either omit or note concisely in Open Questions.
- NEVER attribute to @handles. No "as shared by", "according to", "as suggested by". Write the substance only.
- NEVER repeat the same point in different words.
- SKIP spam, scam links, and pure self-promotion entirely. Pretend they don't exist.
- If the collection has fewer than 3 substantive tweets after filtering spam, write: "Insufficient signal — only [N] substantive tweets. Key points:" followed by a single bullet list.
- Write in present tense, imperative mood where possible.
- Length: proportional to signal density. 3 tweets = 3-5 sentences. 20 tweets = full structured brief.`,
      },
      {
        role: 'user',
        content: tweetBlock,
      },
    ];

    const result = await callWithRotation(SUMMARY_PROVIDERS, messages, 1500);
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
    const tweetBlock = formatTweetBlock(tweets);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You extract actionable takeaways from curated tweets about "${collectionName}". Output is reference material for LLMs — every takeaway must contain enough substance to act on WITHOUT reading the original tweets.

CRITICAL: Only produce a takeaway when a tweet contains a SPECIFIC technique, prompt, workflow, comparison, or configuration. Produce 2-7 takeaways — fewer is better than padding with generic advice. DO NOT force conclusions if tweets lack substance.

SKIP these entirely (do not create a takeaway):
- Tweets that just mention a tool name without explaining what it does or how to use it
- Tweets that are just a link with no explanation
- Tweets that are reactions ("I just learned about X") with no technique
- Marketing hype with no actionable content
- Spam and self-promotion

FOR EACH TAKEAWAY:
- Be EXTREMELY concise. Provide the raw instruction or insight without introductory fluff. 1-2 sentences maximum.
- Start with an imperative verb (e.g., "Install", "Configure", "Use").
- DO NOT use filler phrases like "This allows for...", "This highlights the value...", "Consider using...", "leverage its capabilities" or "to enhance...". 
- If a tweet shares a specific prompt, quote it verbatim.
- If a tweet compares tools, state the specific comparison (which tool is better at what).
- If a tweet describes a workflow, list the exact steps concisely.

ANTI-HALLUCINATION & ANTI-FLUFF:
- NEVER invent steps, frameworks, gaps, or processes not explicitly in the tweets.
- NEVER attach percentages, dollar amounts, or outcome predictions.
- NEVER reference @handles or authors.
- If only 1-2 tweets have real substance, produce only 1-2 takeaways. Do NOT pad.
- Omit any "why" explanations unless the tweet itself provided a specific, technical reason.

Return ONLY a JSON array of strings.`,
      },
      {
        role: 'user',
        content: tweetBlock,
      },
    ];

    const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 1200);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'conclude', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    const parsed = parseAiJson<unknown[]>(result.content, 'conclusions');
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error('[AI] Invalid conclusions response:', result.content);
      return null;
    }
    return parsed.map(String).map(stripMetricClaims);
  },
  /**
   * Identify the most valuable contributors to follow based on their tweets in this collection.
   */
  async generateKeyPeople(
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<{ handle: string; reason: string }[] | null> {
    const handles = [...new Set(tweets.map((t) => `@${sanitizeForPrompt(t.author_handle, 100)}`))].join(', ');
    const tweetBlock = formatTweetBlock(tweets);

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

    const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 400, 0.7);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'key_people', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    const parsed = parseAiJson<unknown[]>(result.content, 'key_people');
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((p: unknown) => p && typeof p === 'object' && 'handle' in p && 'reason' in p)
      .map((p) => {
        const q = p as { handle: unknown; reason: unknown };
        return { handle: String(q.handle).replace(/^@/, ''), reason: String(q.reason) };
      });
  },

  async generateInsights(
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<string[] | null> {
    const tweetBlock = formatTweetBlock(tweets);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You distill curated tweets into a dense knowledge brief. Your output is stored as .md reference material that LLMs consume to execute tasks — so every insight must contain enough detail to act on WITHOUT the original tweets.

STEP 1 — IDENTIFY KNOWLEDGE AREAS (MECE):
Read all tweets and identify 3-5 distinct knowledge areas. Areas must be:
- MUTUALLY EXCLUSIVE: Apply the swap test — if an insight could plausibly belong to two areas, MERGE those areas into one. For example, "Prompt Engineering" and "Prompt Optimization" must merge into one area. "AI Tools" and "Prompt Engineering" overlap because prompts use tools — pick the more specific one.
- COLLECTIVELY EXHAUSTIVE: Every substantive tweet maps to exactly one area.
- SUBJECT-BASED: Name areas by WHAT is studied (e.g., "Visual Design", "Market Analysis"), not HOW it is studied (avoid "Tools", "Methods", "Techniques" as standalone areas).

STEP 2 — PRODUCE INSIGHTS:
Write 5-8 insights total, distributed across the areas you identified. Each insight is a standalone paragraph:
"**[Area Name]** — **[Technique name]**: [What it is and when to use it]. [Step-by-step how-to with enough detail to execute]. [What this replaces or improves upon]."

RULES:
- ZERO METRICS. Never include percentages, dollar amounts, or multipliers. No "25% increase", "$5,000 value", "3x faster". These are marketing claims, not facts. Describe techniques ONLY.
- ZERO OUTCOME PREDICTIONS. No "this leads to", "expected result", "you will see", "improvement in". Describe the HOW, never the imagined result.
- When a tweet contains a verbatim prompt or template, quote it using markdown.
- When a tweet names a framework with steps, list ALL steps.
- When a tweet names specific tools, include tool names and their role.
- DO NOT mention @handles, sources, or attribution.
- SKIP spam, scam links, and self-promotion.

Return ONLY a JSON array of strings.`,
      },
      { role: 'user', content: tweetBlock },
    ];

    const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 1500, 0.7);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'insights', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    const parsed = parseAiJson<unknown[]>(result.content, 'insights');
    if (!Array.isArray(parsed)) return null;
    return parsed.map(String).map(stripMetricClaims);
  },

  /**
   * Assign MECE topic labels to tweets within a collection.
   * Returns the ordered list of topics and a mapping of tweet ID to topic name.
   */
  async assignTopics(
    tweets: { id: string; content: string }[],
    userId?: string
  ): Promise<{ topics: string[]; assignments: Record<string, string> } | null> {
    if (tweets.length === 0) return null;

    const numberedTweets = tweets
      .map((t, i) => `${i + 1}. [ID:${t.id}] ${sanitizeForPrompt(t.content)}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You categorize tweets into MECE (Mutually Exclusive, Collectively Exhaustive) knowledge areas.

INSTRUCTIONS:
1. Read all tweets and identify 3-5 knowledge areas that cover ALL tweets.
2. Areas must be MUTUALLY EXCLUSIVE — if a tweet could fit two areas, MERGE those areas into one.
3. Areas must be COLLECTIVELY EXHAUSTIVE — every tweet maps to exactly one area.
4. Name areas by SUBJECT (e.g., "Machine Learning", "Content Strategy"), not by method ("Tools", "Techniques").
5. Assign each tweet to exactly one area using its [ID:...] tag.

Return ONLY valid JSON:
{
  "topics": ["Area 1", "Area 2", "Area 3"],
  "assignments": { "tweet-id-1": "Area 1", "tweet-id-2": "Area 2" }
}`,
      },
      { role: 'user', content: numberedTweets },
    ];

    const result = await callWithRotation(CATEGORIZATION_PROVIDERS, messages, 1000, 0.3);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'assign_topics', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    const parsed2 = parseAiJson<{ topics: unknown[]; assignments: Record<string, unknown> }>(result.content, 'assign_topics');
    if (!parsed2?.topics || !parsed2?.assignments) return null;

    const topics = Array.isArray(parsed2.topics) ? parsed2.topics.map(String) : [];
    const assignments: Record<string, string> = {};
    for (const [tweetId, topic] of Object.entries(parsed2.assignments)) {
      assignments[tweetId] = String(topic);
    }

    return { topics, assignments };
  },

  async generateDigest(
    tweets: { author_handle: string; content: string }[],
    userId?: string
  ): Promise<{ kta: string[]; new_voices: { handle: string; reason: string }[] } | null> {
    const tweetBlock = formatTweetBlock(tweets);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You write a concise digest of newly added tweets — like a newsletter entry for what's new.

Return JSON with exactly two keys:
    - "kta": array of 3 - 5 key takeaways and actions from these specific new tweets.Skip spam, scam links, and pure self - promotion.Each takeaway must start with an action verb.If fewer than 2 genuine takeaways exist, return ["No significant new content in this batch."]
      - "new_voices": array of up to 3 new contributors worth noting(people whose ideas stood out in this batch), each as { "handle": "...", "reason": "..." }.Only include people who shared something concrete and actionable.

Return ONLY valid JSON: { "kta": [...], "new_voices": [...] }`,
      },
      { role: 'user', content: tweetBlock },
    ];

    const result = await callWithRotation(CONCLUSIONS_PROVIDERS, messages, 600, 0.7);
    if (!result) return null;

    logAiCall({ userId, provider: result.provider, operation: 'digest', tokensIn: result.tokensIn, tokensOut: result.tokensOut });

    const parsed = parseAiJson<{ kta: unknown[]; new_voices: unknown[] }>(result.content, 'digest');
    if (!parsed?.kta || !parsed.new_voices) return null;
    return {
      kta: Array.isArray(parsed.kta) ? parsed.kta.map(String) : [],
      new_voices: Array.isArray(parsed.new_voices)
        ? parsed.new_voices
          .filter((p: unknown) => p && typeof p === 'object' && 'handle' in p && 'reason' in p)
          .map((p) => {
            const q = p as { handle: unknown; reason: unknown };
            return { handle: String(q.handle).replace(/^@/, ''), reason: String(q.reason) };
          })
        : [],
    };
  },

};
