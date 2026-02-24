import { createClient } from '@supabase/supabase-js';

/** Module-level singleton — avoids creating a new admin client on every call. */
let serviceClient: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return serviceClient;
}

/** Fire-and-forget logging of AI provider calls to the ai_calls table. */
export function logAiCall(params: {
  userId?: string;
  provider: string;
  operation: string;
  tokensIn: number;
  tokensOut: number;
}) {
  const supabase = getServiceClient();

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
