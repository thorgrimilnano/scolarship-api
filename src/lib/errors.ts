import { NextResponse } from 'next/server';
import type { ApiErrorBody } from '@/types/scholarship';
import { withCors } from '@/lib/cors';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  origin: string | null = null
): NextResponse<ApiErrorBody> {
  return withCors(NextResponse.json({ error: { code, message } }, { status }), origin);
}

export function handleRouteError(err: unknown, origin: string | null = null): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return errorResponse(err.status, err.code, err.message, origin);
  }
  // Never leak stack traces / internals in production responses.
  console.error(err);
  return errorResponse(500, 'internal_error', 'Something went wrong. Please try again later.', origin);
}
