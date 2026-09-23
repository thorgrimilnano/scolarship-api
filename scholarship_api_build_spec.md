# Scholarship Search API — Build Spec

## 1. What we're building

A public read API that powers a scholarship search tool for high school students. Students need to search/filter scholarships by things like deadline, amount, GPA, state, citizenship, and requirements (e.g. "no essay"), and view full scholarship details. This spec covers the API layer only — the database already exists and is populated (see Section 3).

**Primary users:** high schoolers and their counselors, searching from a web frontend (built separately, consumes this API).

## 2. Tech stack requirements

* **Runtime:** Node.js + TypeScript.
* **Framework:** Next.js (App Router, API routes) is preferred since it deploys to Vercel with zero config. A standalone Express app wrapped for Vercel serverless functions is acceptable if Next.js is not desired — either way, routes must map cleanly to Vercel's serverless function model (stateless, no long-lived in-memory state between requests).
* **Database driver:** SQLite (see Section 3). Use `better-sqlite3` for local/dev speed; if native-binary compatibility on Vercel's build image becomes a problem, fall back to `libsql`/`@libsql/client` (works against a local file *and* against hosted Turso with no code changes) or `sql.js` (WASM, zero native deps, safest but slower). Pick one and document the choice — do not mix drivers.
* **Validation:** `zod` (or equivalent) for query-param and response validation.
* **API docs:** OpenAPI 3.0 + Swagger UI — see Section 5, this is a hard requirement, not optional polish.
* **Testing:** basic integration tests per endpoint (happy path + at least one filter combo + one 4xx case) using `vitest` or `jest`.

### Important constraint: SQLite on Vercel is read-only at runtime

Vercel serverless functions have an **ephemeral, read-only-in-practice filesystem** — anything written to disk during a request does not persist to the next request or across regions. Our data pipeline is batch-oriented (CSV → cleaned → SQLite file, see prior data cleaning work), not user-generated in real time, so this is fine as long as we design for it:

* Ship the built `.db` file committed to the repo (or generated at build time by a `prebuild` script that runs the CSV → SQLite pipeline) as a **read-only bundled asset**.
* All API routes only ever `SELECT` from it.
* To refresh data (new CSV import), regenerate the `.db` file and redeploy — do not add write endpoints against the bundled file.
* If a future requirement needs live writes (e.g. an admin panel, user-submitted scholarships, view/save counters), migrate to **Turso** (hosted libSQL, SQLite-compatible over the network) instead of trying to write to the bundled file. Flag this decision to the team rather than improvising a workaround.

## 3. Database

**Technology:** SQLite, with an FTS5 virtual table for full-text search. Already built and populated from a cleaned CSV import (5,959 scholarships, 0 foreign-key violations, validated in a real SQLite connection).

**Live schema (exact DDL from the built database):**

```sql
CREATE TABLE scholarships (
    id                      INTEGER PRIMARY KEY,
    slug                    TEXT NOT NULL UNIQUE,
    source_url              TEXT,
    name                    TEXT NOT NULL,
    provider_name           TEXT,
    description             TEXT,
    apply_url               TEXT,
    application_method      TEXT CHECK (application_method IN ('Online','Email') OR application_method IS NULL),
    contact_email           TEXT,

    amount_min              INTEGER,
    amount_max              INTEGER,
    amount_type             TEXT CHECK (amount_type IN ('fixed','varies') OR amount_type IS NULL),
    num_awards              INTEGER,

    deadline_mmdd           TEXT,          -- 'MM-DD', recurring annual (source has no year)
    deadline_type           TEXT CHECK (deadline_type IN ('fixed_annual','rolling','varies') OR deadline_type IS NULL),

    min_gpa                 REAL,
    age_min                 INTEGER,
    age_max                 INTEGER,
    grade_level             TEXT,          -- currently only 'high_school' populated by source
    gender                  TEXT CHECK (gender IN ('Female','Male') OR gender IS NULL),
    ethnicity               TEXT,
    has_state_restriction   INTEGER NOT NULL DEFAULT 0 CHECK (has_state_restriction IN (0,1)),

    essay_required               INTEGER NOT NULL DEFAULT 0 CHECK (essay_required IN (0,1)),
    transcript_required          INTEGER NOT NULL DEFAULT 0 CHECK (transcript_required IN (0,1)),
    recommendation_required      INTEGER NOT NULL DEFAULT 0 CHECK (recommendation_required IN (0,1)),
    interview_required           INTEGER NOT NULL DEFAULT 0 CHECK (interview_required IN (0,1)),
    financial_need_required      INTEGER NOT NULL DEFAULT 0 CHECK (financial_need_required IN (0,1)),
    test_scores_required         INTEGER NOT NULL DEFAULT 0 CHECK (test_scores_required IN (0,1)),
    photo_required                INTEGER NOT NULL DEFAULT 0 CHECK (photo_required IN (0,1)),
    resume_required               INTEGER NOT NULL DEFAULT 0 CHECK (resume_required IN (0,1)),
    community_service_required   INTEGER NOT NULL DEFAULT 0 CHECK (community_service_required IN (0,1)),
    contest_entry_required       INTEGER NOT NULL DEFAULT 0 CHECK (contest_entry_required IN (0,1)),
    application_form_required    INTEGER NOT NULL DEFAULT 0 CHECK (application_form_required IN (0,1)),
    application_fee_required     INTEGER NOT NULL DEFAULT 0 CHECK (application_fee_required IN (0,1)),
    portfolio_required           INTEGER NOT NULL DEFAULT 0 CHECK (portfolio_required IN (0,1)),
    drivers_license_required     INTEGER NOT NULL DEFAULT 0 CHECK (drivers_license_required IN (0,1)),
    autobiography_required       INTEGER NOT NULL DEFAULT 0 CHECK (autobiography_required IN (0,1)),
    military_service_required    INTEGER NOT NULL DEFAULT 0 CHECK (military_service_required IN (0,1)),
    special_requirements_flag    INTEGER NOT NULL DEFAULT 0 CHECK (special_requirements_flag IN (0,1)),

    extra_criteria          TEXT CHECK (extra_criteria IS NULL OR json_valid(extra_criteria)),

    source                  TEXT NOT NULL DEFAULT 'accessscholarships.com',
    is_active               INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE states              (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);

CREATE TABLE institution_types   (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);

CREATE TABLE citizenships        (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);

CREATE TABLE military_branches   (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);

CREATE TABLE disability_types    (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);

CREATE TABLE scholarship_states (
    scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
    state_id       INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    PRIMARY KEY (scholarship_id, state_id)
);

CREATE TABLE scholarship_institution_types (
    scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
    institution_type_id INTEGER NOT NULL REFERENCES institution_types(id) ON DELETE CASCADE,
    PRIMARY KEY (scholarship_id, institution_type_id)
);

CREATE TABLE scholarship_citizenships (
    scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
    citizenship_id INTEGER NOT NULL REFERENCES citizenships(id) ON DELETE CASCADE,
    PRIMARY KEY (scholarship_id, citizenship_id)
);

CREATE TABLE scholarship_military_branches (
    scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
    military_branch_id INTEGER NOT NULL REFERENCES military_branches(id) ON DELETE CASCADE,
    PRIMARY KEY (scholarship_id, military_branch_id)
);

CREATE TABLE scholarship_disability_types (
    scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
    disability_type_id INTEGER NOT NULL REFERENCES disability_types(id) ON DELETE CASCADE,
    PRIMARY KEY (scholarship_id, disability_type_id)
);

CREATE VIRTUAL TABLE scholarships_fts USING fts5(
    name, provider_name, description, extra_criteria,
    content='scholarships', content_rowid='id'
);

CREATE TABLE 'scholarships_fts_data'(id INTEGER PRIMARY KEY, block BLOB);

CREATE TABLE 'scholarships_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID;

CREATE TABLE 'scholarships_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB);

CREATE TABLE 'scholarships_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID;

CREATE INDEX idx_scholarships_deadline ON scholarships(is_active, deadline_mmdd);

CREATE INDEX idx_scholarships_amount   ON scholarships(is_active, amount_max);

CREATE INDEX idx_scholarships_gpa      ON scholarships(min_gpa);

CREATE INDEX idx_ss_state  ON scholarship_states(state_id);

CREATE INDEX idx_sit_type  ON scholarship_institution_types(institution_type_id);

CREATE INDEX idx_sc_cit    ON scholarship_citizenships(citizenship_id);

CREATE TRIGGER scholarships_ai AFTER INSERT ON scholarships BEGIN
    INSERT INTO scholarships_fts(rowid, name, provider_name, description, extra_criteria)
    VALUES (new.id, new.name, new.provider_name, new.description, new.extra_criteria);
END;

```

**Notes on the schema for whoever implements the API:**

* Boolean flags are stored as `INTEGER` (`0`/`1`) per SQLite convention — cast to real booleans in API responses.
* `extra_criteria` is a JSON-encoded array of free-text eligibility notes that didn't fit a structured column (essay prompts, one-off requirements, required-document lists). Parse it with `JSON.parse` before returning it in a response; return `[]` if null.
* `deadline_mmdd` is a recurring `MM-DD` string with **no year** (source data doesn't publish one) — do not treat it as a full date; sort/filter it as a string or day-of-year, and surface `deadline_type` (`fixed_annual` / `rolling` / `varies` / `null`) alongside it so the frontend can render it correctly.
* Multi-valued attributes (`states`, `institution_types`, `citizenships`, `military_branches`, `disability_types`) live in junction tables — always join, never assume a scholarship has only one value.
* `scholarships_fts` is kept in sync via an `AFTER INSERT` trigger on `scholarships`. Since we don't do runtime writes (see Section 2), this only matters for the import/build step, not the API.
* Known data gaps (documented in the import's data-quality report, carry these into API responses honestly — don't fabricate missing values):
  * 406 scholarships have `has_state_restriction = 1` but no resolved state list (source ambiguity).
  * No `majors`/field-of-study data exists in the source at all — do not add a `major` filter param until this is sourced separately.
  * ~7% of scholarships have no deadline info (`deadline_type IS NULL`).

## 4. API endpoints

All endpoints are read-only (`GET`). Base path: `/api/v1`.

### `GET /api/v1/scholarships`
Search and filter. Query params (all optional, combine with AND):

| Param | Type | Notes |
|---|---|---|
| `q` | string | free-text search against name, provider, description, extra_criteria (FTS5) |
| `state` | string | state name, e.g. `California` |
| `institution_type` | enum | `four-year college` \| `two-year college` \| `trade/technical school` |
| `citizenship` | enum | `US` \| `Canada` \| `International` |
| `gpa_max` | number | return scholarships whose `min_gpa` is `<=` this (i.e. student qualifies) |
| `amount_min` | integer | filter on `amount_max >=` this |
| `deadline_before` | string `MM-DD` | for `fixed_annual` deadlines only |
| `no_essay` | boolean | shorthand for `essay_required = 0` |
| `grade_level` | string | currently only `high_school` is populated |
| `gender` | enum | `Female` \| `Male` |
| `sort` | enum | `deadline` \| `amount` \| `relevance` (default: `relevance` if `q` present, else `deadline`) |
| `page`, `limit` | integer | pagination, default `limit=20`, max `100` |

Response: `{ data: Scholarship[], pagination: { page, limit, total, has_more } }`.

### `GET /api/v1/scholarships/{slug}`
Full detail for one scholarship, including all joined multi-valued attributes and parsed `extra_criteria`. 404 with a standard error body if not found.

### `GET /api/v1/scholarships/facets`
Accepts the same filter params as the search endpoint (minus `page`/`limit`) and returns counts per filter value for the *current* result set, e.g.:
```json
{ "states": [{"name": "California", "count": 42}], "institution_types": [...], "citizenships": [...] }
```
Powers filter-chip counts in the UI without a separate round trip per filter.

### `GET /api/v1/meta/states`, `/meta/institution-types`, `/meta/citizenships`
Static lookup lists (no filters) for populating dropdowns before a search is run.

### `GET /api/v1/health`
Liveness check for Vercel/monitoring — confirms the bundled DB file opens and returns `{"status":"ok","scholarship_count": N}`.

### Error format (all endpoints)
```json
{ "error": { "code": "invalid_param", "message": "gpa_max must be a number between 0 and 5" } }
```
Use standard HTTP status codes (400 for bad params, 404 for missing resource, 500 for unexpected errors — never leak stack traces in production responses).

## 5. API documentation (Swagger) — required

* Maintain an OpenAPI 3.0 spec (`openapi.yaml` or generated via `zod-to-openapi` / `swagger-jsdoc` from route annotations — either is fine, but pick one source of truth, don't hand-maintain a spec that drifts from the code).
* Serve interactive Swagger UI at `/api/docs` (via `swagger-ui-express` behind a Next.js API route, or `next-swagger-doc` + a small Swagger UI React page — whichever fits the chosen framework).
* The spec must document every endpoint from Section 4: query params, response schemas (including the `Scholarship` object shape), and error responses.
* Keep the raw spec available at `/api/openapi.json` so the frontend or other tools can codegen a client against it.

## 6. Deployment — GitHub → Vercel

* Code lives in a GitHub repo; Vercel is connected to that repo for automatic deploys (production on `main`, preview deploys on PRs).
* Include a `vercel.json` only if routing/rewrites need customization beyond Next.js/Vercel defaults — otherwise rely on convention-based routing.
* Add a `prebuild` (or `postinstall`) script if the SQLite file is generated from the CSV at build time rather than committed directly; otherwise commit the built `.db` file to the repo (check its size — if it grows large over time, revisit whether it belongs in git or should be fetched from storage at build time).
* No secrets/environment variables are required for the read-only MVP described here. If the Turso migration path (Section 2) is taken later, its connection URL and auth token must go in Vercel's encrypted environment variables, never committed.
* CORS: allow requests from the frontend's domain(s); keep it locked down rather than `*` once the frontend domain is known.
* Include a root `README.md` covering: local dev setup, how to regenerate the SQLite file from a new CSV, how to run tests, and the Vercel deploy flow.

## 7. Deliverables checklist

* [ ] Next.js (or Express-on-Vercel) project scaffolded with TypeScript
* [ ] SQLite file bundled/generated and loaded read-only by the API layer
* [ ] All endpoints in Section 4 implemented with param validation and the standard error format
* [ ] OpenAPI spec + Swagger UI live at `/api/docs`
* [ ] Basic integration tests for each endpoint
* [ ] Connected GitHub repo deploying to Vercel (prod + preview deploys)
* [ ] README with local setup, data refresh, and deploy instructions

## 8. Open questions to confirm before/while building

* Final choice of SQLite driver (`better-sqlite3` vs `libsql` vs `sql.js`) — depends on how comfortable we are with native binaries on Vercel's build image.
* Whether `.db` file is committed to git or generated at build time from the CSV pipeline.
* Frontend domain(s) for CORS allow-list.
* Whether `majors`/field-of-study search is needed soon enough to justify sourcing that data now (currently absent from the dataset).
