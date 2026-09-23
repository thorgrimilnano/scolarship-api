import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { NextResponse } from 'next/server';

const SPEC_PATH = path.join(process.cwd(), 'openapi.yaml');

export async function GET() {
  const raw = fs.readFileSync(SPEC_PATH, 'utf-8');
  const spec = yaml.load(raw);
  return NextResponse.json(spec);
}
