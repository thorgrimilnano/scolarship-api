import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import type { FacetValue, Facets, Scholarship } from '@/types/scholarship';
import type { FacetsQuery, SearchQuery } from '@/lib/validation';

// Raw shape of a `scholarships` row, straight from SQLite (booleans as 0/1).
interface ScholarshipRow {
  id: number;
  slug: string;
  source_url: string | null;
  name: string;
  provider_name: string | null;
  description: string | null;
  apply_url: string | null;
  application_method: 'Online' | 'Email' | null;
  contact_email: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_type: 'fixed' | 'varies' | null;
  num_awards: number | null;
  deadline_mmdd: string | null;
  deadline_type: 'fixed_annual' | 'rolling' | 'varies' | null;
  min_gpa: number | null;
  age_min: number | null;
  age_max: number | null;
  grade_level: string | null;
  gender: 'Female' | 'Male' | null;
  ethnicity: string | null;
  has_state_restriction: 0 | 1;
  essay_required: 0 | 1;
  transcript_required: 0 | 1;
  recommendation_required: 0 | 1;
  interview_required: 0 | 1;
  financial_need_required: 0 | 1;
  test_scores_required: 0 | 1;
  photo_required: 0 | 1;
  resume_required: 0 | 1;
  community_service_required: 0 | 1;
  contest_entry_required: 0 | 1;
  application_form_required: 0 | 1;
  application_fee_required: 0 | 1;
  portfolio_required: 0 | 1;
  drivers_license_required: 0 | 1;
  autobiography_required: 0 | 1;
  military_service_required: 0 | 1;
  special_requirements_flag: 0 | 1;
  extra_criteria: string | null;
  source: string;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

interface JoinData {
  states: string[];
  institution_types: string[];
  citizenships: string[];
  military_branches: string[];
  disability_types: string[];
}

const EMPTY_JOINS: JoinData = {
  states: [],
  institution_types: [],
  citizenships: [],
  military_branches: [],
  disability_types: [],
};

type BaseFilters = Omit<SearchQuery, 'page' | 'limit'> | FacetsQuery;

/** Turns free text into a safe, AND-of-quoted-tokens FTS5 MATCH query. */
function toFtsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' ');
}

interface FilterSql {
  joinSql: string;
  whereSql: string;
  params: unknown[];
}

/**
 * Builds the shared WHERE/JOIN clause for search + facets. `exclude` lets a
 * facet dimension skip its own filter, so e.g. the `states` facet shows
 * counts for every state given the *other* active filters (standard
 * filter-chip UX), not just the currently-selected state.
 */
function buildFilterSql(query: BaseFilters, exclude: Set<string> = new Set()): FilterSql {
  const conditions: string[] = ['s.is_active = 1'];
  const params: unknown[] = [];
  let joinSql = '';

  if (query.q && !exclude.has('q')) {
    joinSql += ' JOIN scholarships_fts fts ON fts.rowid = s.id';
    // The FTS5 "table MATCH ?" predicate must reference the real virtual
    // table name, not its alias — better-sqlite3/SQLite raises
    // "no such column" if you try `fts MATCH ?` here.
    conditions.push('scholarships_fts MATCH ?');
    params.push(toFtsQuery(query.q));
  }
  if (query.state && !exclude.has('state')) {
    conditions.push(
      `EXISTS (SELECT 1 FROM scholarship_states ss JOIN states st ON st.id = ss.state_id WHERE ss.scholarship_id = s.id AND st.name = ?)`
    );
    params.push(query.state);
  }
  if (query.institution_type && !exclude.has('institution_type')) {
    conditions.push(
      `EXISTS (SELECT 1 FROM scholarship_institution_types sit JOIN institution_types it ON it.id = sit.institution_type_id WHERE sit.scholarship_id = s.id AND it.name = ?)`
    );
    params.push(query.institution_type);
  }
  if (query.citizenship && !exclude.has('citizenship')) {
    conditions.push(
      `EXISTS (SELECT 1 FROM scholarship_citizenships sc JOIN citizenships c ON c.id = sc.citizenship_id WHERE sc.scholarship_id = s.id AND c.name = ?)`
    );
    params.push(query.citizenship);
  }
  if (query.gpa_max !== undefined && !exclude.has('gpa_max')) {
    // NULL min_gpa means "no GPA requirement" -> every student qualifies.
    conditions.push('(s.min_gpa IS NULL OR s.min_gpa <= ?)');
    params.push(query.gpa_max);
  }
  if (query.amount_min !== undefined && !exclude.has('amount_min')) {
    conditions.push('s.amount_max >= ?');
    params.push(query.amount_min);
  }
  if (query.deadline_before && !exclude.has('deadline_before')) {
    conditions.push("s.deadline_type = 'fixed_annual' AND s.deadline_mmdd <= ?");
    params.push(query.deadline_before);
  }
  if (query.no_essay && !exclude.has('no_essay')) {
    conditions.push('s.essay_required = 0');
  }
  if (query.grade_level && !exclude.has('grade_level')) {
    conditions.push('s.grade_level = ?');
    params.push(query.grade_level);
  }
  if (query.gender && !exclude.has('gender')) {
    conditions.push('s.gender = ?');
    params.push(query.gender);
  }

  return { joinSql, whereSql: conditions.join(' AND '), params };
}

function buildOrderBy(sort: 'deadline' | 'amount' | 'relevance', hasFts: boolean): string {
  if (sort === 'relevance' && hasFts) return 'fts.rank ASC';
  if (sort === 'amount') return '(s.amount_max IS NULL) ASC, s.amount_max DESC';
  return '(s.deadline_mmdd IS NULL) ASC, s.deadline_mmdd ASC';
}

export interface SearchResult {
  rows: Scholarship[];
  total: number;
}

export function searchScholarships(query: SearchQuery): SearchResult {
  const db = getDb();
  const { joinSql, whereSql, params } = buildFilterSql(query);

  const total = (
    db.prepare(`SELECT COUNT(*) as total FROM scholarships s ${joinSql} WHERE ${whereSql}`).get(...params) as {
      total: number;
    }
  ).total;

  const sort = query.sort ?? (query.q ? 'relevance' : 'deadline');
  const orderBy = buildOrderBy(sort, Boolean(query.q));
  const offset = (query.page - 1) * query.limit;

  const rows = db
    .prepare(`SELECT s.* FROM scholarships s ${joinSql} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, query.limit, offset) as ScholarshipRow[];

  const joins = fetchJoinData(
    db,
    rows.map((r) => r.id)
  );

  return { rows: rows.map((row) => toScholarship(row, joins.get(row.id) ?? EMPTY_JOINS)), total };
}

export function getScholarshipBySlug(slug: string): Scholarship | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM scholarships WHERE slug = ? AND is_active = 1')
    .get(slug) as ScholarshipRow | undefined;
  if (!row) return null;
  const joins = fetchJoinData(db, [row.id]);
  return toScholarship(row, joins.get(row.id) ?? EMPTY_JOINS);
}

function facetDimension(
  db: Database.Database,
  query: FacetsQuery,
  excludeKey: string,
  junctionTable: string,
  junctionColumn: string,
  lookupTable: string
): FacetValue[] {
  const { joinSql, whereSql, params } = buildFilterSql(query, new Set([excludeKey]));
  const sql = `
    SELECT lut.name AS name, COUNT(DISTINCT s.id) AS count
    FROM scholarships s
    JOIN ${junctionTable} jt ON jt.scholarship_id = s.id
    JOIN ${lookupTable} lut ON lut.id = jt.${junctionColumn}
    ${joinSql}
    WHERE ${whereSql}
    GROUP BY lut.name
    ORDER BY count DESC, lut.name ASC
  `;
  return db.prepare(sql).all(...params) as FacetValue[];
}

export function getFacets(query: FacetsQuery): Facets {
  const db = getDb();
  return {
    states: facetDimension(db, query, 'state', 'scholarship_states', 'state_id', 'states'),
    institution_types: facetDimension(
      db,
      query,
      'institution_type',
      'scholarship_institution_types',
      'institution_type_id',
      'institution_types'
    ),
    citizenships: facetDimension(db, query, 'citizenship', 'scholarship_citizenships', 'citizenship_id', 'citizenships'),
  };
}

export function getScholarshipCount(): number {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) as total FROM scholarships WHERE is_active = 1').get() as { total: number })
    .total;
}

export function listLookup(table: 'states' | 'institution_types' | 'citizenships'): string[] {
  const db = getDb();
  return (db.prepare(`SELECT name FROM ${table} ORDER BY name ASC`).all() as { name: string }[]).map((r) => r.name);
}

function fetchJoinData(db: Database.Database, ids: number[]): Map<number, JoinData> {
  const map = new Map<number, JoinData>();
  for (const id of ids) {
    map.set(id, { states: [], institution_types: [], citizenships: [], military_branches: [], disability_types: [] });
  }
  if (ids.length === 0) return map;

  const placeholders = ids.map(() => '?').join(',');
  const dimensions: [keyof JoinData, string, string, string][] = [
    ['states', 'scholarship_states', 'state_id', 'states'],
    ['institution_types', 'scholarship_institution_types', 'institution_type_id', 'institution_types'],
    ['citizenships', 'scholarship_citizenships', 'citizenship_id', 'citizenships'],
    ['military_branches', 'scholarship_military_branches', 'military_branch_id', 'military_branches'],
    ['disability_types', 'scholarship_disability_types', 'disability_type_id', 'disability_types'],
  ];

  for (const [key, junctionTable, junctionColumn, lookupTable] of dimensions) {
    const sql = `
      SELECT jt.scholarship_id AS id, lut.name AS name
      FROM ${junctionTable} jt
      JOIN ${lookupTable} lut ON lut.id = jt.${junctionColumn}
      WHERE jt.scholarship_id IN (${placeholders})
    `;
    const rows = db.prepare(sql).all(...ids) as { id: number; name: string }[];
    for (const { id, name } of rows) {
      map.get(id)?.[key].push(name);
    }
  }

  return map;
}

function toScholarship(row: ScholarshipRow, joins: JoinData): Scholarship {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    provider_name: row.provider_name,
    description: row.description,
    source_url: row.source_url,
    apply_url: row.apply_url,
    application_method: row.application_method,
    contact_email: row.contact_email,
    amount: {
      min: row.amount_min,
      max: row.amount_max,
      type: row.amount_type,
    },
    num_awards: row.num_awards,
    deadline: {
      mmdd: row.deadline_mmdd,
      type: row.deadline_type,
    },
    eligibility: {
      min_gpa: row.min_gpa,
      age_min: row.age_min,
      age_max: row.age_max,
      grade_level: row.grade_level,
      gender: row.gender,
      ethnicity: row.ethnicity,
      has_state_restriction: Boolean(row.has_state_restriction),
      states: joins.states,
      institution_types: joins.institution_types,
      citizenships: joins.citizenships,
      military_branches: joins.military_branches,
      disability_types: joins.disability_types,
    },
    requirements: {
      essay_required: Boolean(row.essay_required),
      transcript_required: Boolean(row.transcript_required),
      recommendation_required: Boolean(row.recommendation_required),
      interview_required: Boolean(row.interview_required),
      financial_need_required: Boolean(row.financial_need_required),
      test_scores_required: Boolean(row.test_scores_required),
      photo_required: Boolean(row.photo_required),
      resume_required: Boolean(row.resume_required),
      community_service_required: Boolean(row.community_service_required),
      contest_entry_required: Boolean(row.contest_entry_required),
      application_form_required: Boolean(row.application_form_required),
      application_fee_required: Boolean(row.application_fee_required),
      portfolio_required: Boolean(row.portfolio_required),
      drivers_license_required: Boolean(row.drivers_license_required),
      autobiography_required: Boolean(row.autobiography_required),
      military_service_required: Boolean(row.military_service_required),
      special_requirements_flag: Boolean(row.special_requirements_flag),
    },
    extra_criteria: row.extra_criteria ? JSON.parse(row.extra_criteria) : [],
    source: row.source,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
