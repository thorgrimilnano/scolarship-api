import { NextRequest } from 'next/server';
import { facetsQuerySchema, parseQuery } from '@/lib/validation';
import { getFacets } from '@/lib/scholarships';
import { jsonResponse, optionsResponse } from '@/lib/response';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(facetsQuerySchema, request.nextUrl.searchParams);
    const facets = getFacets(query);
    return jsonResponse(request, facets);
  } catch (err) {
    return handleRouteError(err, request.headers.get('origin'));
  }
}

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}
