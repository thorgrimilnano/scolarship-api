# Scholarship Search API

Public, read-only API powering a scholarship search tool for high school students.
Built with Next.js (App Router) + TypeScript, reading from a bundled, read-only
SQLite file. See `scholarship_api_build_spec.md` (original spec) for the full
requirements this implements.

## Tech choices

- **Framework:** Next.js 14 App Router, deployed to Vercel as serverless functions.
- **DB driver:** `better-sqlite3`. Chosen over `libsql`/`sql.js` for local/dev
  speed and simplicity — all access is synchronous, read-only `SELECT`s. If
  native-binary compatibility on Vercel's build image ever becomes a problem,
  swap to `@libsql/client` (works unchanged against the same local file and
  against hosted Turso) or `sql.js` (WASM, no native deps, slower). Do not mix
  drivers — `better-sqlite3` is the only one wired up today.
- **Validation:** `zod`, applied to query params on every route.
- **Docs:** Hand-maintained `openapi.yaml` is the single source of truth,
  served as JSON at `/api/openapi.json` and rendered as Swagger UI (via CDN
  assets) at `/api/docs`.
- **Tests:** `vitest`, calling each route handler's exported `GET` function
  directly (no server boot required).

## Data & the SQLite file

`data/scholarships.db` is committed to the repo as a **read-only bundled
asset** (~8MB — fine to commit at this size; revisit if it grows
significantly). Vercel's serverless filesystem is ephemeral/read-only in
practice, so:

- Every route only ever runs `SELECT` statements (`src/lib/db.ts` opens the
  connection with `readonly: true`).
- There are no write endpoints, and there must not be any against this file.
- To refresh data: regenerate `scholarships.db` from a new CSV import (via
  the separate data-cleaning pipeline that produced this schema), replace
  `data/scholarships.db`, commit, and push — Vercel will redeploy with the
  new file.
- If a future requirement needs live writes (admin panel, user-submitted
  scholarships, view/save counters), migrate to **Turso** (hosted libSQL)
  rather than trying to write to the bundled file — flag that decision
  before implementing it.

### Notable filter semantics (documented since the spec left them open)

- `gpa_max`: matches scholarships where `min_gpa <= gpa_max` **or**
  `min_gpa IS NULL` (no GPA requirement means every student qualifies).
- `amount_min`: filters on `amount_max >= amount_min` literally, per spec —
  scholarships with a `NULL` `amount_max` are excluded when this filter is
  used.
- `deadline_before`: only ever applies to `deadline_type = 'fixed_annual'`
  rows; compared as a plain `MM-DD` string.
- `/scholarships/facets`: each facet dimension (`states`,
  `institution_types`, `citizenships`) is counted with every *other* active
  filter applied but ignoring that dimension's own filter — the standard
  faceted-search UX, so a user can see counts for switching states while a
  state is already selected.
- Known data gaps (carried through honestly, not fabricated): 406
  scholarships have `has_state_restriction = 1` with no resolved state list;
  no `major`/field-of-study data exists yet; ~7% of scholarships have
  `deadline_type IS NULL`.

## Local development

```bash
npm install
npm run dev       # http://localhost:3000
npm run typecheck
npm test
```

Try it:

- `GET http://localhost:3000/api/v1/scholarships?state=California&no_essay=true`
- `GET http://localhost:3000/api/v1/scholarships/facets?citizenship=US`
- `GET http://localhost:3000/api/v1/health`
- Docs: `http://localhost:3000/api/docs`

## Regenerating the SQLite file from a new CSV

This repo does not include the CSV → SQLite import pipeline (that's a
separate, prior data-cleaning project). To refresh data:

1. Run that pipeline against the new CSV to produce a new `scholarships.db`
   matching the schema in `scholarship_api_build_spec.md` Section 3.
2. Replace `data/scholarships.db` in this repo with the new file.
3. Run `npm test` locally against the new file to sanity-check the API still
   returns sane results (update any test slugs/fixtures if the underlying
   data changed enough to invalidate them).
4. Commit and push to `main` (or open a PR for a preview deploy first).

## Deployment (GitHub → Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel — no build configuration needed beyond Next.js
   defaults (no `vercel.json` required).
3. Set `ALLOWED_ORIGINS` in Vercel's project environment variables to a
   comma-separated list of the frontend's real domain(s), e.g.
   `https://scholarships.example.com`. It defaults to
   `http://localhost:3000` for local frontend development, so **set this
   before or immediately after the first prod deploy** — see
   `src/lib/cors.ts`.
4. Production deploys happen automatically on pushes to `main`; PRs get
   preview deploys automatically.
5. No other secrets/env vars are required for this read-only MVP. If the
   Turso migration path is taken later, its connection URL and auth token
   must go in Vercel's encrypted environment variables, never committed.

## API summary

Base path: `/api/v1`. All endpoints are `GET`-only.

| Endpoint | Purpose |
|---|---|
| `GET /scholarships` | Search & filter, paginated |
| `GET /scholarships/{slug}` | Full detail for one scholarship |
| `GET /scholarships/facets` | Facet counts for the current filters |
| `GET /meta/states` | Dropdown data |
| `GET /meta/institution-types` | Dropdown data |
| `GET /meta/citizenships` | Dropdown data |
| `GET /health` | Liveness check |

Full parameter and response documentation: `/api/docs` (Swagger UI) or
`/api/openapi.json` (raw spec, for client codegen).

Errors always look like:

```json
{ "error": { "code": "invalid_param", "message": "gpa_max must be a number between 0 and 5" } }
```

## Open questions carried over from the spec

- Frontend domain(s) for the `ALLOWED_ORIGINS` CORS allow-list — currently
  unset in production.
- Whether `majors`/field-of-study search is needed soon enough to justify
  sourcing that data (absent from the dataset entirely today).
