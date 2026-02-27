import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { requireUser } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ validateOrigin: vi.fn(() => true), csrfForbidden: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
});

describe('POST /api/corpus/reset', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue(null);

    const { POST } = await import('../reset/route');
    const req = new NextRequest('http://localhost/api/corpus/reset', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const mockChain = {
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    };
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn(() => mockChain) },
    } as unknown as Awaited<ReturnType<typeof requireUser>>);

    const { POST } = await import('../reset/route');
    const req = new NextRequest('http://localhost/api/corpus/reset', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
