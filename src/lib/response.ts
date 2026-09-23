import { NextRequest, NextResponse } from 'next/server';
import { withCors, corsHeaders } from '@/lib/cors';

export function jsonResponse<T>(request: NextRequest, data: T, status = 200): NextResponse<T> {
  return withCors(NextResponse.json(data, { status }), request.headers.get('origin'));
}

export function optionsResponse(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}
