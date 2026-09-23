import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/v1/scholarships/route';
import { makeRequest } from './helpers';

describe('GET /api/v1/scholarships', () => {
  it('returns a default page of results with pagination metadata', async () => {
    const res = await GET(makeRequest('/api/v1/scholarships'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(20);
    expect(body.pagination).toMatchObject({ page: 1, limit: 20 });
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it('combines multiple filters with AND (state + no_essay + gpa_max)', async () => {
    const res = await GET(
      makeRequest('/api/v1/scholarships?state=California&no_essay=true&gpa_max=3.5&limit=50')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const scholarship of body.data) {
      expect(scholarship.eligibility.states).toContain('California');
      expect(scholarship.requirements.essay_required).toBe(false);
      expect(scholarship.eligibility.min_gpa === null || scholarship.eligibility.min_gpa <= 3.5).toBe(true);
    }
  });

  it('supports free-text search combined with amount and sort', async () => {
    const res = await GET(makeRequest('/api/v1/scholarships?q=engineering&amount_min=500&sort=amount'));
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const scholarship of body.data) {
      expect(scholarship.amount.max).toBeGreaterThanOrEqual(500);
    }
  });

  it('rejects an out-of-range gpa_max with a 400 and the standard error body', async () => {
    const res = await GET(makeRequest('/api/v1/scholarships?gpa_max=9'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_param');
    expect(body.error.message).toMatch(/gpa_max/);
  });

  it('rejects a limit above the max of 100', async () => {
    const res = await GET(makeRequest('/api/v1/scholarships?limit=500'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_param');
  });
});
