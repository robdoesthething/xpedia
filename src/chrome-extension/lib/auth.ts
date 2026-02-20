import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface SignInResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ email: string } | { error: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let body: { error_description?: string; msg?: string } = {};
    try { body = await res.json(); } catch { /* empty body */ }
    return { error: body.error_description || body.msg || 'Sign in failed' };
  }

  const data: SignInResponse = await res.json();
  const tokens: AuthTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await chrome.storage.local.set({ auth_tokens: tokens, user_email: data.user.email });
  return { email: data.user.email };
}

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('auth_tokens');
  const tokens = result.auth_tokens as AuthTokens | undefined;

  if (!tokens) return null;

  // Refresh if expiring within 60 seconds
  if (Date.now() > tokens.expires_at - 60_000) {
    const refreshed = await refreshToken(tokens.refresh_token);
    if (!refreshed) return null;
    return refreshed.access_token;
  }

  return tokens.access_token;
}

async function refreshToken(refresh: string): Promise<AuthTokens | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) {
    await signOut();
    return null;
  }

  const data: SignInResponse = await res.json();
  const tokens: AuthTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await chrome.storage.local.set({ auth_tokens: tokens });
  return tokens;
}

export async function signOut(): Promise<void> {
  await chrome.storage.local.remove(['auth_tokens', 'user_email']);
}

export async function getStoredEmail(): Promise<string | null> {
  const result = await chrome.storage.local.get('user_email');
  return (result.user_email as string) ?? null;
}
