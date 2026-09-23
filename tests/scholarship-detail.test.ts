import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/v1/scholarships/[slug]/route';
import { makeRequest } from './helpers';

describe('GET /api/v1/scholarships/{slug}', () => {
  it('returns full detail for a known scholarship', async () => {
    const slug = '100-club-of-arizona-scholarship';
    const res = await GET(makeRequest(`/api/v1/scholarships/${slug}`), { params: { slug } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe(slug);
    expect(Array.isArray(body.extra_criteria)).toBe(true);
    expect(typeof body.requirements.essay_required).toBe('boolean');
  });

  it('returns a 404 with the standard error body for an unknown slug', async () => {
    const slug = 'definitely-does-not-exist-xyz';
    const res = await GET(makeRequest(`/api/v1/scholarships/${slug}`), { params: { slug } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('not_found');
  });
});
