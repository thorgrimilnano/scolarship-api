import { NextRequest } from 'next/server';
import { parseQuery, searchQuerySchema } from '@/lib/validation';
import { searchScholarships } from '@/lib/scholarships';
import { jsonResponse, optionsResponse } from '@/lib/response';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(searchQuerySchema, request.nextUrl.searchParams);
    const { rows, total } = searchScholarships(query);
    const hasMore = query.page * query.limit < total;

    return jsonResponse(request, {
      data: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        has_more: hasMore,
      },
    });
  } catch (err) {
    return handleRouteError(err, request.headers.get('origin'));
  }
}

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}
