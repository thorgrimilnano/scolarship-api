import { NextRequest } from 'next/server';
import { listLookup } from '@/lib/scholarships';
import { jsonResponse, optionsResponse } from '@/lib/response';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    return jsonResponse(request, { data: listLookup('states') });
  } catch (err) {
    return handleRouteError(err, request.headers.get('origin'));
  }
}

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}
