import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/v1/health/route';
import { makeRequest } from './helpers';

describe('GET /api/v1/health', () => {
  it('reports ok and a positive scholarship count', async () => {
    const res = await GET(makeRequest('/api/v1/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.scholarship_count).toBeGreaterThan(0);
  });
});
