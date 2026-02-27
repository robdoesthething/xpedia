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

describe('DELETE /api/collections/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue(null);

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest('http://localhost/api/collections/abc', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(401);
  });

  it('returns 200 on success and clears ai_collection_id', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
    });
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
    });

    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: vi.fn(() => ({
          update: mockUpdate,
          delete: mockDelete,
        })),
      },
    } as unknown as Awaited<ReturnType<typeof requireUser>>);

    const { DELETE } = await import('../[id]/route');
    const req = new NextRequest('http://localhost/api/collections/abc', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(200);
    // Verify ai_collection_id was cleared (update was called)
    expect(mockUpdate).toHaveBeenCalledWith({ ai_collection_id: null });
  });
});
