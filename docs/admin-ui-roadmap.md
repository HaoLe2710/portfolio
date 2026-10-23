# Frontend Admin UI Roadmap

This roadmap follows the requested FE Admin phase order. Phase 0 is documentation
only and intentionally does not create admin routes or UI.

## Route Plan

| Route | Purpose | API dependency | Phase | Required components | UX pattern |
| --- | --- | --- | --- | --- | --- |
| `/admin/login` | Authenticate admin user | `POST /api/admin/auth/login` | Phase 3 | login form, validation messages, submit button | centered login form |
| `/admin` | Admin landing/dashboard placeholder | `GET /api/admin/auth/me` | Phase 4 | protected layout, page header, summary links | quiet admin overview |
| `/admin/profile` | Edit active profile singleton | `GET/PUT /api/admin/profile` | Phase 5 | bilingual singleton form, save/refetch controls | full-page form |
| `/admin/site-settings` | Edit site/SEO/contact settings | `GET/PUT /api/admin/site-settings` | Phase 5 | singleton form, SEO/contact fields | full-page form |
| `/admin/contact-links` | Manage contact links | contact-links CRUD/publication APIs | Phase 6A | table, filters, form dialog/page, publish toggle, delete confirm | compact CRUD list |
| `/admin/achievements` | Manage achievements | achievements CRUD/publication APIs | Phase 6A | table, form dialog/page, publish toggle | compact CRUD list |
| `/admin/certificates` | Manage certificates | certificates CRUD/publication APIs | Phase 6A | table, form dialog/page, publish toggle | compact CRUD list |
| `/admin/skills` | Manage skill groups and skills | skill-groups and skills APIs | Phase 6B | grouped list, nested skill rows, conflict errors | nested editor |
| `/admin/projects` | Manage project list | `GET /api/admin/projects`, publication/featured/delete APIs | Phase 7A | table, filters, featured/publish toggles | content list |
| `/admin/projects/new` | Create project | `POST /api/admin/projects` | Phase 7A | project root form | create form |
| `/admin/projects/[id]` | Edit project detail and child data | `GET/PUT /api/admin/projects/{id}` plus toggles | Phase 7A/7B | root form, child list editors, JSON metadata editor, preview | multi-section editor |
| `/admin/blog-posts` | Manage blog post list | `GET /api/admin/blog-posts`, publication/featured/delete APIs | Phase 8A | table, filters, featured/publish toggles | content list |
| `/admin/blog-posts/new` | Create blog post | `POST /api/admin/blog-posts` | Phase 8A | blog root form, markdown fields | create form |
| `/admin/blog-posts/[id]` | Edit blog post | `GET/PUT /api/admin/blog-posts/{id}` plus toggles | Phase 8A/8B | form, markdown editor/preview, tags, SEO preview | editor workspace |
| `/admin/audit-logs` | Browse audit logs | `GET /api/admin/audit-logs` | Phase 9 | filter bar, paginated table | filterable log table |
| `/admin/audit-logs/[id]` | Inspect audit detail | `GET /api/admin/audit-logs/{id}` | Phase 9 | detail header, before/after JSON viewer, metadata viewer | read-only detail |

## Module Plan

### 1. Admin Auth

- Implement login against `POST /api/admin/auth/login`.
- Store access token according to the selected token storage decision.
- Load current admin from `GET /api/admin/auth/me`.
- Provide logout by clearing token and cached admin state.
- Handle `401 UNAUTHORIZED` globally for admin requests.
- Add protected route guard after the auth data model is settled.

### 2. Admin Shell

- Add an admin route group/layout in a later phase.
- Include sidebar, topbar, breadcrumb, and reusable page header.
- Keep the admin shell utilitarian and dense enough for repeated CMS work.
- Reuse existing colors, focus states, Material Symbols, and dark/light theme.
- Do not reuse public marketing-style section composition for admin screens.

### 3. Profile + Site Settings

- Build singleton forms for active profile and site settings.
- Support bilingual admin fields such as `titleEn`/`titleVi` style fields where
  the backend exposes them.
- Use Zod validation and `react-hook-form`.
- Save through `PUT`, then refetch or update query cache.
- Show clear missing-singleton `404` handling because PUT does not create rows.

### 4. Lightweight CMS

- Modules: contact links, achievements, certificates.
- Use a common table/dialog or table/form-page pattern.
- Support create, edit, publish/unpublish, and hard delete.
- Add delete confirmation and save/delete toasts.
- Preserve display order fields and publication state.

### 5. Skills

- Manage skill groups and nested skills from one `/admin/skills` route.
- Support group create/edit/delete and nested skill create/edit/delete.
- Show `409 CONFLICT` clearly when deleting a skill group with existing skills.
- Include publish toggles for both groups and skills.
- Consider drag/reorder only after basic CRUD is stable.

### 6. Projects

- Phase 7A: project list plus root create/edit fields.
- Phase 7B: child editors for tags, tech stack, highlights, responsibilities,
  statuses, links, metrics, and content blocks.
- Warn in the UI/model layer that child list persistence uses replace-all
  semantics: submit complete child arrays, not partial patches.
- Validate slug format before submit.
- Validate content block `metadata` as a JSON object.
- Provide project content preview using existing public block renderers where
  practical.

### 7. Blog Posts

- Phase 8A: blog list plus root create/edit fields.
- Phase 8B: markdown editor, markdown preview, tags, and SEO preview.
- Warn that tag persistence uses replace-all semantics.
- Validate slug format and publication date input.
- Keep frontend public blog types separate from admin bilingual edit fields.

### 8. Audit Logs

- Implement read-only audit log list with filters and pagination.
- Support detail view for sanitized snapshots and metadata.
- Use a JSON viewer component with wrapping and overflow handling.
- Keep audit UI read-only; no mutation APIs exist.

### 9. UX Hardening

- Add shared loading, error, empty, confirm dialog, toast, and unsaved-changes
  primitives.
- Ensure mobile admin layouts remain usable without overdecorated cards.
- Preserve keyboard focus visibility and accessible labels for icon actions.
- Add optimistic updates only when rollback behavior is clear.

## Phase Sequence

| Phase | Scope |
| --- | --- |
| Phase 0 | Survey, API matrix, route plan, component reuse plan, risks |
| Phase 1 | API client foundation |
| Phase 2 | Public API mapping |
| Phase 3 | Admin auth UI |
| Phase 4 | Admin shell/layout |
| Phase 5 | Profile + site settings UI |
| Phase 6A | Contact links, achievements, certificates UI |
| Phase 6B | Skills UI |
| Phase 7A | Project list/basic form |
| Phase 7B | Project child editors/content blocks |
| Phase 8A | Blog list/basic form |
| Phase 8B | Blog markdown/tags/SEO preview |
| Phase 9 | Audit logs UI |
| Phase 10 | UX hardening |
| Phase 11 | Runtime QA/build/deploy config |

## Component Reuse Plan

| Existing component | Reuse in admin | Needed additions |
| --- | --- | --- |
| `Button`, `buttonVariants` | primary/save/cancel/destructive action base | semantic destructive variant, submit loading conventions |
| `Badge` | publication, featured, role, tag labels | status-specific variants |
| `Card` | isolated panels only | avoid nested admin cards |
| `Container` | optional admin content width wrapper | admin shell may need a denser wrapper |
| `EmptyState` | no rows/search results | retry/error variant |
| `MaterialIcon` | nav and action icons | consistent icon map |
| `MarkdownContent` | blog/project preview | markdown editor and split preview |
| project content renderers | project detail preview | admin editable block forms |
| `ThemeProvider`, `ThemeToggle` | preserve light/dark mode | admin shell placement |

Missing primitives to build in later phases:

- text input, textarea, select, checkbox/toggle, switch
- form field wrapper and validation message
- table, pagination, filter bar
- dialog/confirm dialog
- toast notifications
- loading skeletons
- error/retry state
- admin sidebar/topbar/breadcrumb/page header
- JSON object editor/viewer
- markdown editor/preview container

## Risks and Decisions

### 1. Token Storage Decision

Backend login returns a JWT access token and no refresh token. The frontend must
choose between localStorage, memory, or cookie storage. For an initial admin CMS,
localStorage may be acceptable temporarily because it is simple and works with a
client-side guard, but it increases exposure if XSS occurs. A cookie-based token
would support middleware protection better, but the backend contract does not
currently describe cookie issuing.

Phase 1 uses a localStorage-backed token store at
`portfolio.admin.accessToken`. Access is guarded with `typeof window !==
"undefined"` so server rendering does not crash. This is a temporary
implementation detail for the first admin CMS iteration and should be revisited
if the backend adds HTTP-only cookie or refresh-token support.

### 2. Admin Route Protection

With a client-stored token, the first admin version can use a client-side guard
that redirects unauthenticated users after hydration. Middleware protection can
be deferred unless the token is moved to an HTTP-only cookie strategy.

The Phase 1 admin API client throws `UNAUTHORIZED` when no token exists and
clears the stored token on backend `401`, but it does not redirect. Redirects and
route guards remain Phase 3/4 work.

### 3. Replace-All Child Lists

Project child data and blog tags use replace-all update semantics. Frontend
forms must send complete child arrays on create/update and should avoid partial
patch mental models for these children.

### 4. JSON Metadata Editor

Project content block `metadata` must be a JSON object. The frontend needs
syntax validation and object-shape validation before submit. Null can be treated
as `{}` only if the adapter intentionally follows backend behavior.

### 5. Markdown Editor

Blog content and project markdown content blocks need markdown editing and
preview. Existing `MarkdownContent` can render previews, but there is no editor
component yet.

### 6. Locale

Public API supports `en|vi` and returns localized fields directly. Admin DTOs
expose bilingual fields directly. Public pages must not expose admin field names
such as `titleEn` or `descriptionVi`; adapters should keep these models separate.

Phase 2 adds public DTO types and adapters that map backend localized public
responses into existing frontend UI models. Public pages continue to avoid admin
bilingual field names.

### 7. Runtime Dependency

Frontend API mode requires the backend to be running at
`NEXT_PUBLIC_API_BASE_URL`. Mock mode remains the default and should continue to
work without a backend.

### 8. Security Limitations

There is no refresh token, no role matrix, no rate-limit UI, and no complete
session-expiry UX yet. The admin client should handle token expiry and `401`
responses clearly before CRUD screens are built.

### 9. API Envelope And DTO Drift

Backend APIs return `ApiResponse<T>` envelopes. Current public frontend API code
does not unwrap envelopes and assumes response data already matches localized UI
types. Phase 1/2 must correct this before admin work depends on the client.

Phase 2 migrates the public portfolio API source to the envelope-aware
`public-client`. Backend DTO drift is handled in
`src/lib/portfolio/public-api-adapter.ts`; admin API integration remains
separate.

## Readiness Criteria For Phase 1

Phase 1 can start when:

- Phase 0 docs are accepted.
- Only frontend docs changed in this phase.
- The team agrees on token storage for initial admin auth.
- The API client foundation includes envelope unwrap and normalized error
  handling from the start.
