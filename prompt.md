# Google AI Studio Prompt: Scholarship Search and Visualization Site

Build a polished, responsive single-page web app called "ScholarSearch" that helps high school students find and explore scholarships. Use React + TypeScript + Tailwind CSS, and Recharts for charts. All data comes from a public, read-only REST API (no auth, GET only). Do not hardcode or invent scholarship data.

## 1. API reference

OpenAPI spec: https://scolarship-api.vercel.app/api/openapi.json Base URL: https://scolarship-api.vercel.app/api/v1 (put it in a single constant so it is easy to change). The dataset has about 5,959 scholarships.

API & Proxy: Put the upstream base URL (https://scolarship-api.vercel.app/api/v1) in a single server-side constant and proxy all GET /api/v1/* requests through a lightweight Express backend (server.ts) so the frontend fetches from same-origin /api/v1/*. Do not call the external domain directly from the browser (the upstream API does not send Access-Control-Allow-Origin headers).

Endpoints:

* GET /scholarships: search and filter. All params are optional and combine with AND.
  
  * q (string): full-text search over name, provider, description and extra_criteria
  * state (string): state name, e.g. "California"
  * institution_type (enum): "four-year college" | "two-year college" | "trade/technical school"
  * citizenship (enum): "US" | "Canada" | "International"
  * gpa_max (number, 0-5): returns scholarships whose min_gpa is &lt;= this value or that have no GPA requirement, i.e. the ones the student qualifies for. Label this in the UI as "My GPA".
  * amount_min (integer): filters on amount.max &gt;= value
  * deadline_before (string "MM-DD"): only applies to scholarships with deadline.type = "fixed_annual"
  * no_essay (boolean): when true, only scholarships with essay_required = false
  * grade_level (string): only "high_school" is populated, so send it by default
  * gender (enum): "Female" | "Male"
  * sort (enum): "deadline" | "amount" | "relevance" (default is relevance when q is set, otherwise deadline)
  * page (int, default 1), limit (int, 1-100, default 20)
  * Response: { data: Scholarship\[\], pagination: { page, limit, total, has_more } }
* GET /scholarships/facets: accepts the same filters as above (no page/limit). Returns { states: \[{name, count}\], institution_types: \[{name, count}\], citizenships: \[{name, count}\] }. Each dimension's counts ignore that dimension's own filter, so use them to show "how many results if I also pick X" next to every filter option.
* GET /scholarships/{slug}: full detail for one scholarship. Returns 404 with { error: { code, message } } if not found.
* GET /meta/states, /meta/institution-types, /meta/citizenships: return { data: string\[\] } for populating dropdowns.
* GET /health: returns { status: "ok", scholarship_count: number }. Use it for a "5,959 scholarships" stat in the hero section.

Errors have the shape { error: { code, message } } (400 invalid_param, 404 not_found, 500 internal_error). Show the message in a friendly inline error banner with a Retry button.

Scholarship object (nullable fields are marked "?"):

* id, slug, name
* provider_name?, description?, source_url?, apply_url?, contact_email?
* application_method?: "Online" | "Email"
* amount: { min?, max?, type?: "fixed" | "varies" }
* num_awards?
* deadline: { mmdd? ("MM-DD", recurring every year, no year), type?: "fixed_annual" | "rolling" | "varies" }
* eligibility: { min_gpa?, age_min?, age_max?, grade_level?, gender?, ethnicity?, has_state_restriction (bool), states\[\], institution_types\[\], citizenships\[\], military_branches\[\], disability_types\[\] }
* requirements: booleans for essay, transcript, recommendation, interview, financial_need, test_scores, photo, resume, community_service, contest_entry, application_form, application_fee, portfolio, drivers_license, autobiography, military_service, special_requirements_flag (each named \*\_required except the last)
* extra_criteria: string\[\] (free-text eligibility notes)
* source, is_active, created_at, updated_at

Data quirks to handle gracefully:

* Many fields are null. Never render "null" or "undefined"; show "Not specified" or hide the row.
* has_state_restriction can be true while states\[\] is empty (about 406 records). Show a "State-restricted (details unclear)" badge in that case.
* Deadlines have no year. Display "Every Mar 15" for fixed_annual, "Rolling" for rolling, "Varies" for varies. Compute "days until next deadline" from the current date, rolling over to next year if the date has passed.
* Amounts: if min == max show "$5,000"; otherwise show a range "$1,000 - $5,000"; if type is "varies" show "Varies".

## 2. Core features

### Search and filters

* A prominent search bar (debounced 400 ms) bound to q.
* A filter sidebar (a bottom-sheet drawer on mobile) with:
  
  * State dropdown (from /meta/states)
  * Institution type (checkbox/radio chips)
  * Citizenship (chips)
  * GPA slider (0.0-5.0, step 0.1) labelled "My GPA", mapped to gpa_max
  * Minimum award amount (slider or quick chips: $500, $1k, $5k, $10k+)
  * "Apply before" date picker (month + day only), mapped to deadline_before as MM-DD
  * Toggle "No essay required"
  * Gender (optional, "Any" by default)
* Show live counts next to the state, institution type and citizenship options using /scholarships/facets, re-fetched whenever other filters change. Disable or grey out options with count 0.
* Active filters appear as removable chips above the results, plus a "Clear all" button.
* Sort dropdown (Best match, Deadline soonest, Highest amount) and a page-size selector (20/50/100).
* Sync all filters, sort and page to the URL query string so searches are shareable and the back button works.
* Pagination (or "Load more") driven by the pagination object, with a "Showing 1-20 of 1,234 scholarships" label.

### Results

* A responsive card grid with a list/grid toggle. Each card shows: name, provider, a bold award amount, deadline badge (color-coded: red if within 14 days, amber within 45 days, green otherwise, grey for rolling/varies), num_awards, and small icon chips for key requirements (essay, transcript, recommendation, interview, financial need).
* Clicking a card opens a detail drawer or page (route /scholarship/:slug) that calls GET /scholarships/{slug} and shows the full description, eligibility, a requirements checklist (a check or cross icon for each \*\_required flag), extra_criteria as bullets, contact email, an "Apply now" button (apply_url, falling back to source_url) opening in a new tab, and a "Copy link" button.
* Let users bookmark scholarships (heart icon) into a "Saved" list stored in localStorage, with a Saved view and a "Compare" option that shows up to 3 saved scholarships side by side.

### Visualizations (an "Insights" tab or section above the results)

All charts must reflect the current filters and update when filters change. Use Recharts, with tooltips and an accessible color palette.

1. Scholarships by state: horizontal bar chart of the top 15 states from /scholarships/facets. Clicking a bar applies that state filter.
2. Institution type split: donut chart from the facets. Clicking a slice applies the filter.
3. Citizenship split: a small bar or donut chart from the facets.
4. Award amount distribution: histogram with buckets ($0-500, $500-1k, $1k-2.5k, $2.5k-5k, $5k-10k, $10k+) using amount.max.
5. Deadline calendar: a bar or heatmap by month (Jan-Dec, optionally by day) of fixed_annual deadlines, showing the best months to apply. Also show a count of rolling and varies deadlines as separate stat tiles.
6. Requirements breakdown: a horizontal bar chart showing the percentage of scholarships requiring each item (essay, transcript, recommendation, interview, financial need, and so on).
7. GPA requirement profile: a bar chart of min_gpa buckets (None, &lt;=2.0, 2.0-2.5, 2.5-3.0, 3.0-3.5, 3.5+).
8. Summary stat tiles: total matches, average max award, largest award, number requiring no essay, and number with a deadline in the next 30 days.

Data strategy for charts: charts 1-3 use /scholarships/facets (one call, accurate for the full filtered set). Charts 4-8 need record-level data. Fetch pages of limit=100 for the current filters in the background, up to 10 pages (1,000 records), with a progress indicator, and cache by filter signature. If total is more than the fetched count, show a note such as "Charts based on the first 1,000 of 3,420 matches". Cancel in-flight requests when filters change (AbortController).

### "Match me" quick start

A friendly 4-step wizard on the landing view (state, GPA, planned school type, "Do you want to skip essays?") that fills in the filters and jumps to the results. This is optional for the user to skip.

## 3. UX, design and quality requirements

* Audience is teenagers and parents: friendly, modern, high-contrast, clean typography (Inter), a rounded-xl card style, and a calm blue/indigo primary with an emerald accent for money. Include dark mode that follows the system preference and has a manual toggle.
* Fully responsive (mobile first) and keyboard accessible: labelled inputs, focus rings, aria-labels on icon buttons, and charts with a text summary or data table fallback ("View as table" toggle).
* Loading skeletons for cards and charts, a helpful empty state ("No matches. Try lowering the minimum amount or removing a filter") with a one-click "Clear filters" action, and error states with Retry.
* Handle network errors and possible CORS failures gracefully: if the API cannot be reached, show a clear message and do not crash. Keep all fetching in one small api.ts module with typed functions (searchScholarships, getFacets, getScholarship, getMeta, getHealth) and TypeScript types matching the schema above.
* Use a simple in-memory cache plus request de-duplication so repeated filter combinations do not refetch.
* Add a small footer: "Data from the Scholarship Search API. Always verify details and deadlines on the official scholarship page before applying."
* Keep the code organized into components (SearchBar, FilterPanel, FilterChips, ScholarshipCard, ScholarshipDrawer, InsightsDashboard and one component per chart, SavedList, CompareView, MatchWizard) and hooks (useScholarships, useFacets, useUrlState, useSaved).

## 4. Deliverable

Generate the complete, runnable app. Start by calling /health, /meta/\* and /scholarships?limit=20 on load, so the first screen shows real data. Briefly list any assumptions you made at the end.
