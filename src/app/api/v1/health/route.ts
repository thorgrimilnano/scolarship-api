import { NextRequest } from 'next/server';
import { getScholarshipCount } from '@/lib/scholarships';
import { jsonResponse, optionsResponse } from '@/lib/response';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const scholarship_count = getScholarshipCount();
    return jsonResponse(request, { status: 'ok', scholarship_count });
  } catch (err) {
    return handleRouteError(err, request.headers.get('origin'));
  }
}

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}
