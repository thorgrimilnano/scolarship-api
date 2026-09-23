import { NextRequest } from 'next/server';
import { getScholarshipBySlug } from '@/lib/scholarships';
import { jsonResponse, optionsResponse } from '@/lib/response';
import { errorResponse, handleRouteError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const scholarship = getScholarshipBySlug(params.slug);
    if (!scholarship) {
      return errorResponse(404, 'not_found', `No scholarship found with slug "${params.slug}"`, request.headers.get('origin'));
    }
    return jsonResponse(request, scholarship);
  } catch (err) {
    return handleRouteError(err, request.headers.get('origin'));
  }
}

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}
