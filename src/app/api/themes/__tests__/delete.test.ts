import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { requireUser } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  requireUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  validateOrigin: vi.fn(() => true),
  csrfForbidden: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
});

describe('DELETE /api/themes/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue(null);

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest('http://localhost/api/themes/123', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 when orphan_action is missing or invalid', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn() },
    } as unknown as Awaited<ReturnType<typeof requireUser>>);

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest('http://localhost/api/themes/123?orphan_action=invalid');
    const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when theme not found', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
              })),
            })),
          })),
        })),
      },
    } as unknown as Awaited<ReturnType<typeof requireUser>>);

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest('http://localhost/api/themes/123?orphan_action=uncategorize');
    const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(404);
  });
});
