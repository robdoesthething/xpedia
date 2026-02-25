import { createServiceClient } from '@/lib/supabase/service';

/** Fire-and-forget logging of AI provider calls to the ai_calls table. */
export function logAiCall(params: {
  userId?: string;
  provider: string;
  operation: string;
  tokensIn: number;
  tokensOut: number;
}) {
  const supabase = createServiceClient();

  supabase
    .from('ai_calls')
    .insert({
      user_id: params.userId ?? null,
      provider: params.provider,
      operation: params.operation,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
    } as never)
    .then(({ error }) => {
      if (error) console.error('[AI Logger] Failed to log call:', error.message);
    });
}
