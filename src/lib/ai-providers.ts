export interface AIProvider {
  name: string;
  baseURL: string;
  model: string;
  apiKeyEnvVar: string;
}

const GEMINI: AIProvider = {
  name: 'Google AI Studio',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  model: 'gemini-2.5-flash-preview-05-20',
  apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
};

const GROQ: AIProvider = {
  name: 'Groq',
  baseURL: 'https://api.groq.com/openai/v1',
  model: 'llama-3.3-70b-versatile',
  apiKeyEnvVar: 'GROQ_API_KEY',
};

const CEREBRAS: AIProvider = {
  name: 'Cerebras',
  baseURL: 'https://api.cerebras.ai/v1',
  model: 'llama-3.3-70b',
  apiKeyEnvVar: 'CEREBRAS_API_KEY',
};

const SAMBANOVA: AIProvider = {
  name: 'SambaNova',
  baseURL: 'https://api.sambanova.ai/v1',
  model: 'Meta-Llama-3.3-70B-Instruct',
  apiKeyEnvVar: 'SAMBANOVA_API_KEY',
};

/** Categorization: quality-first (Gemini primary, fast fallbacks). */
export const CATEGORIZATION_PROVIDERS: AIProvider[] = [
  GEMINI,
  GROQ,
  CEREBRAS,
  SAMBANOVA,
];

/** Summary generation: long-context preferred. */
export const SUMMARY_PROVIDERS: AIProvider[] = [
  GEMINI,
  GROQ,
  CEREBRAS,
];

/** Conclusions generation: quality preferred. */
export const CONCLUSIONS_PROVIDERS: AIProvider[] = [
  GEMINI,
  SAMBANOVA,
  GROQ,
];

/** Filter to providers whose API key env var is set. */
export function getAvailableProviders(providers: AIProvider[]): AIProvider[] {
  return providers.filter((p) => !!process.env[p.apiKeyEnvVar]);
}
