# Frontend API Mapping Plan

This document maps current backend contracts to frontend public pages and future
admin CMS modules. Phase 0 documents the plan only; it does not add API client,
adapter, auth, or admin UI code.

## Public API Mapping

Backend public APIs return `ApiResponse<T>` envelopes under `/api/public/**`.
The frontend currently has a public data-source abstraction, but it assumes
localized UI-ready payloads and does not unwrap `ApiResponse<T>` yet.

| Backend API | Backend DTO | Frontend type needed | Current frontend service | Current mock source | Used by | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /api/public/profile?locale=en|vi` | `PublicProfileResponse` | `LocalizedProfile` | `getProfile()` | `mockPortfolio.profile` | locale layout metadata, home hero/about/contact, header/footer | partially mapped | Needs envelope unwrap and field adapter: backend has `brandName`/`headline`; frontend expects `brand`/`role` style fields. |
| `GET /api/public/skills?locale=en|vi` | `List<PublicSkillGroupResponse>` | `LocalizedSkillGroup[]` | `getSkillGroups()` | `mockPortfolio.skillGroups` | home skills, hero skill chips | partially mapped | Backend includes `description`, `displayOrder`, skill `level/icon/displayOrder`; frontend currently needs a smaller shape. |
| `GET /api/public/achievements?locale=en|vi` | `List<PublicAchievementResponse>` | `LocalizedAchievement[]` | `getAchievements()` | `mockPortfolio.achievements` | home education/achievements | partially mapped | Backend includes issuer/date/order fields not currently modeled in frontend type. |
| `GET /api/public/certificates?locale=en|vi` | `List<PublicCertificateResponse>` | `LocalizedCertificate[]` | `getCertificates()` | `mockPortfolio.certificates` | home certificates | partially mapped | Backend uses `status` and `issuedAt`; frontend uses `kind` and `official`. Needs adapter decision. |
| `GET /api/public/site-settings?locale=en|vi` | `PublicSiteSettingsResponse` | `LocalizedSiteSettings` | `getSiteSettings()` | `mockPortfolio.siteSettings` | home data aggregation, future SEO defaults | partially mapped | Backend has SEO/contact fields beyond current frontend type. |
| `GET /api/public/contact-links?locale=en|vi` | `List<PublicContactLinkResponse>` | `LocalizedContactLink[]` | `getContactLinks()` | `mockPortfolio.contactLinks` | home contact, footer | partially mapped | Backend uses `url`; frontend type uses `href`. Needs adapter. |
| `GET /api/public/projects?locale=en|vi` | `List<PublicProjectSummaryResponse>` | `LocalizedProject[]` or future `PublicProjectSummary` | `getProjects()`, `getFeaturedProjects()` | `mockPortfolio.projects` | projects page, featured projects, sitemap | partially mapped | Summary DTO lacks detail-only `contentBlocks`; list pages should use a summary type or adapter that fills only required fields. |
| `GET /api/public/projects/{slug}?locale=en|vi` | `PublicProjectDetailResponse` | `LocalizedProject` or future `PublicProjectDetail` | `getProjectBySlug()` | `mockPortfolio.projects` | project detail page, project metadata | partially mapped | Backend content blocks use `markdown` and `metadata` object; frontend blocks currently use typed per-block fields. Needs adapter. |
| `GET /api/public/blog-posts?locale=en|vi` | `List<PublicBlogPostSummaryResponse>` | `LocalizedBlogPost[]` or future `PublicBlogPostSummary` | `getBlogPosts()` | `mockPortfolio.blogPosts` | blog page, latest blog, sitemap | partially mapped | Backend uses `readingTime` string; frontend uses `readingTimeMinutes`. Needs type decision. |
| `GET /api/public/blog-posts/{slug}?locale=en|vi` | `PublicBlogPostDetailResponse` | `LocalizedBlogPost` or future `PublicBlogPostDetail` | `getBlogPostBySlug()` | `mockPortfolio.blogPosts` | blog detail page and metadata | partially mapped | Backend uses `contentMarkdown`; frontend uses `content`. Needs adapter. |
| `GET /api/public/media-assets?locale=en|vi` | `List<PublicMediaAssetResponse>` | planned `PublicMediaAsset[]` | none | none | future media/CV surfaces | not mapped | No frontend media type or service exists yet. |
| `GET /api/public/media-assets/cv?locale=en|vi` | `PublicMediaAssetResponse` | planned `PublicMediaAsset` | none | profile `cvUrl` only | future CV download source | not mapped | Could eventually replace direct `profile.cvUrl` fallback. |
| `GET /api/public/media-assets/{id}?locale=en|vi` | `PublicMediaAssetResponse` | planned `PublicMediaAsset` | none | none | future media detail/preview | not mapped | No current public route needs this endpoint. |

Public adapter requirements:

- Add `ApiResponse<T>` envelope type and unwrap helper.
- Keep public components consuming frontend-facing types, not backend DTOs.
- Treat `/api/public/projects` and `/api/public/blog-posts` as summary APIs,
  separate from detail APIs where practical.
- Preserve mock fallback behavior in `mock` and API failure cases.
- Preserve locale behavior: public API returns localized fields and must not leak
  admin bilingual field names into public pages.

## Admin API Mapping

All admin APIs live under `/api/admin/**`. Except login, routes require
`Authorization: Bearer <accessToken>`.

| Module | Backend APIs | Planned route | Planned service | UI pattern | Phase | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Admin Auth | `POST /api/admin/auth/login`, `GET /api/admin/auth/me` | `/admin/login`, protected `/admin/*` | `features/admin/auth/admin-auth.api.ts` | centered login form, current-admin query, logout action | Phase 3 | medium | Backend returns JWT access token only; no refresh token. Token storage decision required before implementation. |
| Admin Shell | auth-gated admin pages, `GET /api/admin/auth/me` | `/admin` and child routes | shared `admin-client.ts` plus auth service | sidebar, topbar, breadcrumb, page header | Phase 4 | medium | Shell should be client-aware because token likely starts in client storage. |
| Profile | `GET/PUT /api/admin/profile` | `/admin/profile` | `features/admin/profile/admin-profile.api.ts` | singleton form | Phase 5 | low | Bilingual fields and active singleton row; `PUT` does not create missing row. |
| Site Settings | `GET/PUT /api/admin/site-settings` | `/admin/site-settings` | `features/admin/settings/admin-site-settings.api.ts` | singleton form | Phase 5 | low | Includes SEO/contact defaults. |
| Contact Links | `GET`, `GET {id}`, `POST`, `PUT {id}`, `PATCH {id}/publication`, `DELETE {id}` under `/api/admin/contact-links` | `/admin/contact-links` | `features/admin/contact-links/admin-contact-links.api.ts` | table, create/edit dialog or page, publish toggle, delete confirm | Phase 6A | low | `primary=true` does not automatically unset other primary links. |
| Achievements | same CRUD/publication pattern under `/api/admin/achievements` | `/admin/achievements` | `features/admin/achievements/admin-achievements.api.ts` | table plus form/dialog | Phase 6A | low | Bilingual title/description/issuer; display ordering. |
| Certificates | same CRUD/publication pattern under `/api/admin/certificates` | `/admin/certificates` | `features/admin/certificates/admin-certificates.api.ts` | table plus form/dialog | Phase 6A | low | Status fields are bilingual in admin contract. |
| Skill Groups | CRUD/publication under `/api/admin/skill-groups` | `/admin/skills` | `features/admin/skills/admin-skills.api.ts` | grouped list with nested skills | Phase 6B | medium | Deleting a group with skills returns `409 CONFLICT`; show conflict handling. |
| Skills | list/create by group plus item CRUD under `/api/admin/skill-groups/{groupId}/skills` and `/api/admin/skills/{id}` | `/admin/skills` | `features/admin/skills/admin-skills.api.ts` | nested table/list, inline publish toggles | Phase 6B | medium | Update can move skill by optional `groupId`. |
| Projects | `GET`, `GET {id}`, `GET by-slug/{slug}`, `POST`, `PUT {id}`, `PATCH publication`, `PATCH featured`, `DELETE` under `/api/admin/projects` | `/admin/projects`, `/admin/projects/new`, `/admin/projects/[id]` | `features/admin/projects/admin-projects.api.ts` | list, create/edit form, child editors, preview | Phase 7A/7B | high | Child lists use replace-all semantics; metadata must be JSON object; slug conflicts return `409`. |
| Blog Posts | `GET`, `GET {id}`, `GET by-slug/{slug}`, `POST`, `PUT {id}`, `PATCH publication`, `PATCH featured`, `DELETE` under `/api/admin/blog-posts` | `/admin/blog-posts`, `/admin/blog-posts/new`, `/admin/blog-posts/[id]` | `features/admin/blog-posts/admin-blog-posts.api.ts` | list, editor form, markdown preview, SEO preview | Phase 8A/8B | high | Tags use replace-all semantics; `publishedAt` accepts date, offset datetime, blank, or null. |
| Audit Logs | `GET /api/admin/audit-logs`, `GET /api/admin/audit-logs/{id}` | `/admin/audit-logs`, `/admin/audit-logs/[id]` | `features/admin/audit-logs/admin-audit-logs.api.ts` | filterable table, detail JSON viewer | Phase 9 | medium | Filters: `actorAdminId`, `resourceType`, `resourceId`, `action`, `from`, `to`, `page`, `size`. |

## Planned Frontend API Service Structure

The project uses `src/`, so future API and feature modules should be planned
under `frontend/src`.

```txt
frontend/src/lib/api/
|-- api-response.ts
|-- api-error.ts
|-- http-client.ts
|-- public-client.ts
|-- admin-client.ts
`-- auth-token-store.ts

frontend/src/features/admin/
|-- auth/admin-auth.api.ts
|-- profile/admin-profile.api.ts
|-- settings/admin-site-settings.api.ts
|-- contact-links/admin-contact-links.api.ts
|-- achievements/admin-achievements.api.ts
|-- certificates/admin-certificates.api.ts
|-- skills/admin-skills.api.ts
|-- projects/admin-projects.api.ts
|-- blog-posts/admin-blog-posts.api.ts
`-- audit-logs/admin-audit-logs.api.ts

frontend/src/features/public/
`-- public portfolio API adapters can move here later if public integration grows
```

Planned responsibilities:

- `api-response.ts`: shared `ApiResponse<T>` and unwrap helper.
- `api-error.ts`: normalized client error and backend error payload handling.
- `http-client.ts`: base axios instance, timeout, JSON headers, base URL.
- `public-client.ts`: unauthenticated public client using envelope unwrap.
- `admin-client.ts`: authenticated admin client with bearer token injection and
  401 handling hook.
- `auth-token-store.ts`: selected storage strategy for access token.
- Feature API files: endpoint-specific request/response types and functions.

Type strategy:

- Keep backend DTO types separate from UI model types.
- Public pages should continue receiving localized frontend types.
- Admin forms should use admin DTO/form types with `En`/`Vi` fields because the
  admin contract exposes bilingual editing fields directly.
- Add adapters where backend field names differ from current frontend types.
- Use Zod schemas for admin form validation in the implementation phases, not
  in Phase 0.

## Phase 0 Mapping Conclusions

- Current public mock/service boundary is strong enough to preserve while adding
  API adapters.
- Current public API source is useful but incomplete because it lacks
  `ApiResponse<T>` unwrap and DTO normalization.
- No admin API service, token handling, query provider, or admin feature modules
  exist yet.
- Public media endpoints are backend-ready but frontend-unmapped.

## Phase 1 API Client Foundation

Phase 1 adds the shared API foundation under `frontend/src/lib/api/`:

- `api-response.ts` defines `ApiResponse<T>`, backend error payloads,
  `isApiResponse()`, and `unwrapApiResponse()`.
- `api-error.ts` defines normalized `ApiError`, `isApiError()`, and
  `toApiError()`.
- `http-client.ts` defines the base axios client and envelope-aware
  `requestApi<T>()`.
- `public-client.ts` defines unauthenticated public GET support.
- `admin-client.ts` defines authenticated admin request helpers and clears the
  local admin token on `401`.
- `auth-token-store.ts` defines the initial localStorage-backed admin access
  token store.

Compatibility decision: the legacy `src/lib/api-client.ts` remains unchanged in
Phase 1 because `safeApiGet()` has existing public API-mode callers and currently
expects raw frontend-shaped payloads. Public API migration to the new
envelope-aware `public-client` remains Phase 2, alongside public DTO adapters.

Admin auth UI, route guards, admin layout, CRUD feature API files, React Query
provider setup, and public page remapping remain deferred to later phases.

## Phase 2 Public API Mapping

Phase 2 connects the existing public portfolio API source to the Phase 1
envelope-aware `public-client`.

- Backend public DTO types live in `frontend/src/types/public-api.ts`.
- DTO-to-UI adapters live in
  `frontend/src/lib/portfolio/public-api-adapter.ts`.
- `frontend/src/lib/portfolio/api-portfolio-source.ts` now uses
  `publicGet<T>()`, so backend `ApiResponse<T>` envelopes are unwrapped by the
  shared API foundation before adapter mapping.
- Public components and App Router pages still consume existing frontend UI
  models from `frontend/src/types/portfolio.ts`.
- Mock mode and API failure fallback remain owned by
  `frontend/src/lib/portfolio-service.ts`.
- Public media DTO mapping is available through `PublicMediaAsset` and
  `getPublicCvMediaAsset()`, but public pages still use profile `cvUrl` until a
  later UX/API integration decision.
- The legacy `src/lib/api-client.ts` is retained for compatibility, but no
  public portfolio source imports `safeApiGet()` after Phase 2.

Admin API feature files, admin auth UI, route guards, admin layout, CRUD UI, and
React Query provider setup remain deferred to Phase 3+.
