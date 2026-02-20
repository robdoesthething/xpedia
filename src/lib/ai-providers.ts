export interface AIProvider {
  name: string;
  baseURL: string;
  model: string;
  apiKeyEnvVar: string;
}

/** Categorization: speed-first (short output, fast inference). */
export const CATEGORIZATION_PROVIDERS: AIProvider[] = [
  {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnvVar: 'GROQ_API_KEY',
  },
  {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    apiKeyEnvVar: 'CEREBRAS_API_KEY',
  },
  {
    name: 'Google AI Studio',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
  },
  {
    name: 'SambaNova',
    baseURL: 'https://api.sambanova.ai/v1',
    model: 'Meta-Llama-3.3-70B-Instruct',
    apiKeyEnvVar: 'SAMBANOVA_API_KEY',
  },
];

/** Summary generation: long-context preferred. */
export const SUMMARY_PROVIDERS: AIProvider[] = [
  {
    name: 'Google AI Studio',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
  },
  {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnvVar: 'GROQ_API_KEY',
  },
  {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    apiKeyEnvVar: 'CEREBRAS_API_KEY',
  },
];

/** Conclusions generation: quality preferred. */
export const CONCLUSIONS_PROVIDERS: AIProvider[] = [
  {
    name: 'SambaNova',
    baseURL: 'https://api.sambanova.ai/v1',
    model: 'Meta-Llama-3.3-70B-Instruct',
    apiKeyEnvVar: 'SAMBANOVA_API_KEY',
  },
  {
    name: 'Google AI Studio',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
  },
  {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnvVar: 'GROQ_API_KEY',
  },
];

/** Filter to providers whose API key env var is set. */
export function getAvailableProviders(providers: AIProvider[]): AIProvider[] {
  return providers.filter((p) => !!process.env[p.apiKeyEnvVar]);
}
