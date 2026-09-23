import { describe, expect, it } from 'vitest';
import { GET as getStates } from '@/app/api/v1/meta/states/route';
import { GET as getInstitutionTypes } from '@/app/api/v1/meta/institution-types/route';
import { GET as getCitizenships } from '@/app/api/v1/meta/citizenships/route';
import { makeRequest } from './helpers';

describe('GET /api/v1/meta/*', () => {
  it('lists state names', async () => {
    const res = await getStates(makeRequest('/api/v1/meta/states'));
    const body = await res.json();
    expect(body.data).toContain('California');
  });

  it('lists institution types', async () => {
    const res = await getInstitutionTypes(makeRequest('/api/v1/meta/institution-types'));
    const body = await res.json();
    expect(body.data).toEqual(
      expect.arrayContaining(['four-year college', 'two-year college', 'trade/technical school'])
    );
  });

  it('lists citizenships', async () => {
    const res = await getCitizenships(makeRequest('/api/v1/meta/citizenships'));
    const body = await res.json();
    expect(body.data).toEqual(expect.arrayContaining(['US', 'Canada', 'International']));
  });
});
