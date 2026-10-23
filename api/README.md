# Portfolio Worker API

This package runs the public portfolio API as an independent Cloudflare Worker. The Next.js site remains a static export: Pages requests API data only while `next build` generates HTML, project/blog routes, metadata, and the sitemap. Visitors receive static files and do not issue D1 queries.

## Architecture

```text
Cloudflare Pages (Next.js output: out/)
  ├─ pnpm run build ── public GET requests ──> web-portfolio-api Worker
  └─ /api/admin/* Pages Function ── Service Binding ──> web-portfolio-api Worker
                                                        └─ D1 binding DB ──> portfolio_db
```

The repository root `wrangler.toml` remains the Pages configuration. This package uses `api/wrangler.toml`; its Worker name is `web-portfolio-api` and it does not deploy Pages assets.

## Data and API mapping

| Mock data | D1 tables | Public response | Frontend model |
| --- | --- | --- | --- |
| Profile | `profile`, `profile_translations` | `PublicProfileResponse` | `LocalizedProfile` |
| Skill groups and skills | `skill_groups`, `skill_group_translations`, `skills`, `skill_translations` | `PublicSkillGroupResponse[]` | `LocalizedSkillGroup[]` |
| Projects | `projects`, `project_translations`, `project_status_labels`, `project_highlights`, `project_tech_stack`, `project_links` and translations | Project summary/detail DTOs | `LocalizedProject` |
| Project content blocks | `project_content_blocks`, `project_content_block_translations` | `PublicContentBlockResponse[]` | `LocalizedProjectContentBlock[]` |
| Blog posts and tags | `blog_posts`, `blog_post_translations`, `blog_post_tags` | Blog summary/detail DTOs | `LocalizedBlogPost` |
| Achievements | `achievements`, `achievement_translations` | `PublicAchievementResponse[]` | `LocalizedAchievement[]` |
| Certificates | `certificates`, `certificate_translations` | `PublicCertificateResponse[]` | `LocalizedCertificate[]` |
| Contact links | `contact_links`, `contact_link_translations` | `PublicContactLinkResponse[]` | `LocalizedContactLink[]` |
| Site settings | `site_settings`, `site_settings_translations` | `PublicSiteSettingsResponse` | `LocalizedSiteSettings` |

All publishable records use `DRAFT` or `PUBLISHED`. Public SQL filters on `PUBLISHED` and orders by `display_order, id`. Translation tables have a unique `(entity_id, locale)` key. Project block metadata is JSON for the nested feature, architecture, module, CI/CD, gallery, metric, and link structures; outer titles and Markdown bodies are locale rows. SQL values from requests use D1 prepared statements.

The public API implements:

- `GET /healthz`
- `GET /api/public/profile?locale=en`
- `GET /api/public/skills?locale=en`
- `GET /api/public/achievements?locale=en`
- `GET /api/public/certificates?locale=en`
- `GET /api/public/projects?locale=en`
- `GET /api/public/projects/:slug?locale=en`
- `GET /api/public/blog-posts?locale=en`
- `GET /api/public/blog-posts/:slug?locale=en`
- `GET /api/public/contact-links?locale=en`
- `GET /api/public/site-settings?locale=en`

Locale defaults to `en`; only `en` and `vi` are accepted. Unknown slugs return 404. No public write or authentication endpoints are included. The frontend's `getPublicCvMediaAsset` helper is not called by any current route or component; the profile and contact link continue to use the static CV URL already in the source.

## Local development

From the frontend repository root:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm api:dev
```

The Worker listens at `http://127.0.0.1:8787`. To build the static site against that local API, set `NEXT_PUBLIC_DATA_SOURCE=api` and `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787/api` in the build process. The default Pages build remains in `mock` mode until the production gate is explicitly passed.

Run checks with:

```bash
pnpm api:typecheck
pnpm api:test
pnpm db:migrate:local
pnpm db:seed:local
```

## Migrations and seed safety

Migrations live in `api/migrations/` and are versioned by Wrangler. The first schema is `0001_init_schema.sql`. Local D1 state is separate from remote D1.

`pnpm db:seed:local` imports `src/data/mock-portfolio.ts` directly and creates an initial SQL seed. Each insert uses `ON CONFLICT(primary_key) DO NOTHING`; rerunning the seed adds missing rows but never overwrites existing content. `seed_runs` records the import version, source hash, and inserted row counts. There is intentionally no content-update mode: later CMS edits must be changed through an explicit migration or CMS operation, not by rerunning the initial import.

Before any remote operation, inspect `pnpm exec wrangler d1 list` and confirm `portfolio_db` is the portfolio database. Never point these commands at `news-radar-db` or another existing database.

After the portfolio D1 has been created and its UUID added to `api/wrangler.toml`, remote commands are:

```bash
pnpm db:migrate:remote
pnpm db:seed:remote
```

Remote migrations are additive and versioned. The initial remote seed is opt-in, additive, and guarded by the exact database name; it does not drop tables or overwrite existing rows. Verify table counts, locale rows, project blocks, and `seed_runs` after it completes.

## Deployment and rollback

Check the Cloudflare account and existing Worker names before deploying. Deploy only this package:

```bash
pnpm api:deploy
```

The Worker uses the `workers.dev` hostname assigned by Cloudflare. Its URL must be taken from the actual deploy output; do not put a guessed hostname in Pages configuration.

Pages Git integration uses `bash scripts/cloudflare-pages-build.sh`. On `main`, it builds from the production Worker API using the production canonical origin and indexability. On preview branches, it builds from the staging Worker API and staging D1 seed, uses Cloudflare's `CF_PAGES_URL` as the canonical origin, and sets `robots` to noindex. A missing `CF_PAGES_URL` falls back to the local Pages preview host, never the production canonical host.

If a production API build fails, restore the previous mock build command and redeploy the last known-good Pages commit. Worker and Pages releases are separate; rolling back the Worker does not alter the static Pages assets.

## CMS admin and safe staging

The CMS is draft-only. A Pages Function at `/api/admin/*` forwards same-origin admin requests through a Service Binding. Authentication is owner/admin only. New passwords use Argon2id v1.3 with a random 16-byte salt, a 32-byte hash, 19,456 KiB memory, two passes, and one lane; the WASM implementation runs inside the Worker. Existing PBKDF2-SHA-256 accounts at 100,000 iterations remain verifiable and are upgraded to Argon2id after a successful login. Sessions are random, stored as hashes, expire after 12 hours, and use HttpOnly/SameSite cookies. Mutations require a same-origin request; login throttling and audit events are enabled. Cloudflare Access is not enabled for this account, so it is not the authentication layer for this setup. Argon2id's configured work factor matches an OWASP-listed minimum profile; validate real Worker CPU/memory behavior before increasing it. Admin draft snapshots and revision history live in separate `admin_*` tables. The CMS never writes published tables and has no publish or deploy hook.

Migrations `0002_admin_cms.sql` and `0003_argon2id_auth.sql` are additive; keep `0001_init_schema.sql` unchanged. Migration `0003` adds a password algorithm discriminator with a PBKDF2 default so existing accounts remain readable. `password_iterations` remains populated to satisfy the original schema constraint and is ignored for Argon2id hashes. Local setup:

```bash
pnpm db:migrate:local
pnpm db:seed:local
pnpm admin:bootstrap:local
```

For an isolated staging environment, create `portfolio_db_staging`, place only that database UUID in `api/wrangler.staging.toml`, and use these commands:

```bash
pnpm db:migrate:staging
pnpm db:seed:staging
pnpm admin:bootstrap:staging
pnpm api:deploy:staging
```

Staging-specific migration, seed, bootstrap, and deploy commands use `wrangler.staging.toml`. Do not use the production configuration for staging operations or run the existing `db:seed:remote` command against any database other than `portfolio_db`. The bootstrap scripts request the owner credentials in a terminal and never put a password in source control. The Pages preview service binding targets `web-portfolio-api-staging`; the Pages production binding targets `web-portfolio-api` only after an explicit production release.

For local browser E2E tests, `scripts/start-local-admin-preview.mjs` starts a locally named API Worker, waits for its unauthenticated 401 response, then starts Pages so the Service Binding is ready. API integration tests cover actual credential verification and D1 session/draft behavior; the browser sign-in happy path uses a controlled response fixture and checks that the frontend does not persist a bearer token.

For an authenticated test against an actual Pages Preview, set `PORTFOLIO_STAGING_PREVIEW_URL`, `PORTFOLIO_STAGING_API_URL`, and `PORTFOLIO_STAGING_CREDENTIALS_FILE` to the Preview URL, staging Worker URL, and ignored local credential file, then run `pnpm test:admin:preview`. The script refuses the production Pages hostname and a non-staging Worker hostname. It checks the Pages Function session path, draft workflows, all eight project block editors, public Draft isolation, concurrency handling, session expiry, CSRF rejection, invalid input, and responsive layout.
