import { z, ZodError } from 'zod';
import { ApiError } from '@/lib/errors';

const INSTITUTION_TYPES = ['four-year college', 'two-year college', 'trade/technical school'] as const;
const CITIZENSHIPS = ['US', 'Canada', 'International'] as const;
const GENDERS = ['Female', 'Male'] as const;
const SORTS = ['deadline', 'amount', 'relevance'] as const;

function numberParam(min: number, max: number, label: string, integer = false) {
  return z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  }, z
    .number({ invalid_type_error: `${label} must be a number between ${min} and ${max}` })
    .min(min, `${label} must be a number between ${min} and ${max}`)
    .max(max, `${label} must be a number between ${min} and ${max}`)
    .refine((n) => !integer || Number.isInteger(n), `${label} must be an integer`)
    .optional());
}

function booleanParam(label: string) {
  return z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'boolean') return val;
    const s = String(val).trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    return val; // pass through so z.boolean() fails with a clear type error
  }, z.boolean({ invalid_type_error: `${label} must be a boolean (true or false)` }).optional());
}

const baseFilterShape = {
  q: z.string().trim().min(1, 'q must not be empty').optional(),
  state: z.string().trim().min(1, 'state must not be empty').optional(),
  institution_type: z.enum(INSTITUTION_TYPES, {
    errorMap: () => ({ message: `institution_type must be one of: ${INSTITUTION_TYPES.join(', ')}` }),
  }).optional(),
  citizenship: z.enum(CITIZENSHIPS, {
    errorMap: () => ({ message: `citizenship must be one of: ${CITIZENSHIPS.join(', ')}` }),
  }).optional(),
  gpa_max: numberParam(0, 5, 'gpa_max'),
  amount_min: numberParam(0, Number.MAX_SAFE_INTEGER, 'amount_min', true),
  deadline_before: z
    .string()
    .regex(/^\d{2}-\d{2}$/, 'deadline_before must be in MM-DD format, e.g. 04-15')
    .optional(),
  no_essay: booleanParam('no_essay'),
  grade_level: z.string().trim().min(1, 'grade_level must not be empty').optional(),
  gender: z.enum(GENDERS, {
    errorMap: () => ({ message: `gender must be one of: ${GENDERS.join(', ')}` }),
  }).optional(),
  sort: z.enum(SORTS, {
    errorMap: () => ({ message: `sort must be one of: ${SORTS.join(', ')}` }),
  }).optional(),
};

export const searchQuerySchema = z.object({
  ...baseFilterShape,
  page: numberParam(1, Number.MAX_SAFE_INTEGER, 'page', true).default(1),
  limit: numberParam(1, 100, 'limit', true).default(20),
});

export const facetsQuerySchema = z.object(baseFilterShape);

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type FacetsQuery = z.infer<typeof facetsQuerySchema>;

export function parseQuery<T extends z.ZodTypeAny>(schema: T, searchParams: URLSearchParams): z.infer<T> {
  const raw: Record<string, string> = {};
  for (const key of searchParams.keys()) {
    raw[key] = searchParams.get(key) ?? '';
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(400, 'invalid_param', firstIssueMessage(result.error));
  }
  return result.data;
}

function firstIssueMessage(error: ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? 'Invalid query parameters';
}
