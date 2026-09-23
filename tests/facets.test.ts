import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/v1/scholarships/facets/route';
import { makeRequest } from './helpers';

describe('GET /api/v1/scholarships/facets', () => {
  it('returns counts per filter value for the current result set', async () => {
    const res = await GET(makeRequest('/api/v1/scholarships/facets?citizenship=US'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.states)).toBe(true);
    expect(Array.isArray(body.institution_types)).toBe(true);
    expect(Array.isArray(body.citizenships)).toBe(true);
    for (const facet of body.states) {
      expect(typeof facet.name).toBe('string');
      expect(typeof facet.count).toBe('number');
    }
  });

  it('rejects invalid filter params the same way search does', async () => {
    const res = await GET(makeRequest('/api/v1/scholarships/facets?gender=Other'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_param');
  });
});
