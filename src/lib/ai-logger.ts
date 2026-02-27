import { createServiceClient } from '@/lib/supabase/service';

interface AiCallInsert {
  user_id: string | null;
  provider: string;
  operation: string;
  tokens_in: number;
  tokens_out: number;
}

/** Fire-and-forget logging of AI provider calls to the ai_calls table. */
export function logAiCall(params: {
  userId?: string;
  provider: string;
  operation: string;
  tokensIn: number;
  tokensOut: number;
}) {
  const supabase = createServiceClient();

  const payload: AiCallInsert = {
    user_id: params.userId ?? null,
    provider: params.provider,
    operation: params.operation,
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
  };

  supabase
    .from('ai_calls' as unknown as string)
    .insert(payload)
    .then(({ error }) => {
      if (error) console.error('[AI Logger] Failed to log call:', error.message);
    });
}
