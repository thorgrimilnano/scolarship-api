import { NextResponse } from 'next/server';

// Frontend domain(s) allowed to call this API cross-origin. Populate via the
// ALLOWED_ORIGINS env var (comma-separated) once the frontend's domain(s)
// are known; defaults to localhost for local frontend development. Avoid
// "*" once real domains are known (see build spec, Section 6).
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  } else if (ALLOWED_ORIGINS.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  return headers;
}

export function withCors<T extends NextResponse>(res: T, origin: string | null = null): T {
  const headers = corsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}
