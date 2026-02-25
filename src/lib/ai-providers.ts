export interface Quota {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerMinute: number;
}

export interface AIProvider {
  name: string;
  baseURL: string;
  model: string;
  apiKeyEnvVar: string;
  quota: Quota;
}

// Free-tier limits as of Feb 2026 — verify against provider dashboards periodically.
const GEMINI: AIProvider = {
  name: 'Google AI Studio',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemini-2.5-flash',
  apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
  quota: { requestsPerMinute: 10, requestsPerDay: 500, tokensPerMinute: 250_000 },
};

const GROQ: AIProvider = {
  name: 'Groq',
  baseURL: 'https://api.groq.com/openai/v1',
  model: 'llama-3.3-70b-versatile',
  apiKeyEnvVar: 'GROQ_API_KEY',
  quota: { requestsPerMinute: 30, requestsPerDay: 1_000, tokensPerMinute: 6_000 },
};

const CEREBRAS: AIProvider = {
  name: 'Cerebras',
  baseURL: 'https://api.cerebras.ai/v1',
  model: 'qwen-3-235b-a22b-instruct-2507',
  apiKeyEnvVar: 'CEREBRAS_API_KEY',
  quota: { requestsPerMinute: 30, requestsPerDay: 1_000, tokensPerMinute: 60_000 },
};

const SAMBANOVA: AIProvider = {
  name: 'SambaNova',
  baseURL: 'https://api.sambanova.ai/v1',
  model: 'Meta-Llama-3.3-70B-Instruct',
  apiKeyEnvVar: 'SAMBANOVA_API_KEY',
  quota: { requestsPerMinute: 10, requestsPerDay: 1_000, tokensPerMinute: 40_000 },
};

const DEEPSEEK: AIProvider = {
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKeyEnvVar: 'DEEPSEEK_API_KEY',
  quota: { requestsPerMinute: 10, requestsPerDay: 500, tokensPerMinute: 40_000 },
};

/** All known providers — used to display quota info even for unused ones. */
export const ALL_PROVIDERS: AIProvider[] = [GEMINI, GROQ, CEREBRAS, SAMBANOVA, DEEPSEEK];

/** Categorization: quality-first (Gemini primary, fast fallbacks). */
export const CATEGORIZATION_PROVIDERS: AIProvider[] = [GEMINI, GROQ, CEREBRAS, SAMBANOVA, DEEPSEEK];

/** Summary generation: long-context preferred. */
export const SUMMARY_PROVIDERS: AIProvider[] = [GEMINI, GROQ, CEREBRAS, DEEPSEEK];

/** Conclusions generation: quality preferred. */
export const CONCLUSIONS_PROVIDERS: AIProvider[] = [GROQ, GEMINI, SAMBANOVA, DEEPSEEK];

/** Filter to providers whose API key env var is set. */
export function getAvailableProviders(providers: AIProvider[]): AIProvider[] {
  return providers.filter((p) => !!process.env[p.apiKeyEnvVar]);
}

