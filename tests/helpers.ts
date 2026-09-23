import { NextRequest } from 'next/server';

export function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}
